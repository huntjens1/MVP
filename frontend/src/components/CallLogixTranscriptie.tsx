// frontend/src/components/CallLogixTranscriptie.tsx
import { useEffect, useRef, useState } from "react";
import api, { type TicketSkeleton, type TicketOverrides } from "../api";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";
import { maskPII } from "../utils/pii";
import RightPanel, { type Classification } from "./RightPanel";

type DGAlt = { transcript?: string; words?: Array<{ speaker?: number }> };
type DGRealtime = { channel?: { alternatives?: DGAlt[]; is_final?: boolean }; alternatives?: DGAlt[]; is_final?: boolean } | any;

type Segment = { id: string; speaker: "Agent" | "Klant"; text: string; final: boolean; flagged: boolean };

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState<string>("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [runbook, setRunbook] = useState<string[]>([]);
  const [ticket, setTicket] = useState<TicketSkeleton | null>(null);
  const [slaBadge, setSlaBadge] = useState<string>("P4 · TTR ~48u");
  const [summary, setSummary] = useState<string>("");

  // ITIL intake state
  const [classif, setClassif] = useState<Classification>({
    type: "Incident",
    impact: "Low",
    urgency: "Medium",
    priority: "P4",
    ci: "",
  });

  // infra
  const wsRef = useRef<WebSocket | null>(null);
  const micStopRef = useRef<MicStopper | null>(null);
  const convoIdRef = useRef<string>("");
  const sseSuggestRef = useRef<EventSource | null>(null);
  const sseAssistRef = useRef<EventSource | null>(null);
  const debounceTicket = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [coach, setCoach] = useState<string>("");
  const lastContextRef = useRef<string>("");

  useEffect(() => () => { void stopRecording(); }, []);

  // Dead-air coach
  useEffect(() => {
    const iv = setInterval(() => {
      if (!recording) return;
      const idle = Date.now() - lastActivityRef.current;
      setCoach(idle > 8000 ? "Tip: vat samen of stel een verduidelijkingsvraag." : "");
    }, 2000);
    return () => clearInterval(iv);
  }, [recording]);

  function buildWsUrl(token: string) {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const wssBase = base.replace(/^http/i, "ws");
    const url = new URL(`${wssBase}/ws/mic`);
    url.searchParams.set("conversation_id", convoIdRef.current);
    url.searchParams.set("token", token);
    url.searchParams.set("codec", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("language", "nl");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("diarize", "true");
    return url.toString();
  }

  function onWsMessage(ev: MessageEvent) {
    const handleString = (s: string) => { try { handleDG(JSON.parse(s)); } catch {} };
    if (typeof ev.data === "string") return handleString(ev.data);
    if (ev.data instanceof ArrayBuffer) {
      const txt = new TextDecoder().decode(new Uint8Array(ev.data));
      return handleString(txt);
    }
    if ((ev.data as any)?.text) (ev.data as Blob).text().then(handleString).catch(() => {});
  }

  async function handleDG(msg: DGRealtime) {
    const isFinal = Boolean(msg?.channel?.is_final ?? msg?.is_final ?? false);
    const alt: DGAlt | undefined = msg?.channel?.alternatives?.[0] ?? msg?.alternatives?.[0];
    const textRaw = (alt?.transcript || "").trim();
    if (!textRaw && !isFinal) return;

    lastActivityRef.current = Date.now();

    let speaker: "Agent" | "Klant" = "Klant";
    const sp = alt?.words?.find((w) => typeof w.speaker === "number")?.speaker;
    if (sp === 1) speaker = "Agent";

    if (isFinal) {
      setInterim("");
      if (textRaw) {
        const { masked, flagged } = maskPII(textRaw);
        setSegments((list) => {
          const seg: Segment = { id: crypto.randomUUID(), speaker, text: masked, final: true, flagged };
          const next = [...list, seg];
          const ctx = lastN(next, 4);
          lastContextRef.current = ctx;

          // triggers
          void api.suggest(convoIdRef.current, ctx).catch(() => {});
          void api.assist(convoIdRef.current, ctx).catch(() => {});
          if (debounceTicket.current) window.clearTimeout(debounceTicket.current);
          debounceTicket.current = window.setTimeout(() => rebuildTicket(ctx), 1200);

          return next;
        });
      }
    } else {
      const { masked } = maskPII(textRaw);
      setInterim(masked);
    }
  }

  function priFromIU(urg: Classification["urgency"], imp: Classification["impact"]): Classification["priority"] {
    const map = { Low: 4, Medium: 3, High: 2, Critical: 1 };
    const u = map[urg] ?? 3;
    const i = map[imp] ?? 4;
    const p = Math.min(4, Math.max(1, Math.round((u + i) / 2)));
    return (`P${p}` as Classification["priority"]);
  }

  function formatTTR(mins: number) {
    if (mins % 60 === 0) return `${Math.round(mins / 60)}u`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}u${m}m` : `${m}m`;
  }

  function lastN(list: Segment[], n: number) {
    return list.slice(-n).map((s) => `${s.speaker}: ${s.text}`).join("\n");
  }

  // ---------- SSE handlers ----------
  function parseJSON(raw: any) { try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return {}; } }

  function fallbackQuestions(ctx: string): string[] {
    const q: string[] = [];
    const low = ctx.toLowerCase();
    if (low.includes("inlog")) q.push("Krijgt u een foutmelding bij het inloggen? Zo ja, welke exacte melding?");
    if (low.includes("netwerk")) q.push("Werkt het op een ander netwerk of via hotspot? Kunt u een ping/gateway-test proberen?");
    if (low.includes("email") || low.includes("mail")) q.push("Gaat het om de e-mailclient of webmail? En welke account/omgeving?");
    q.push("Sinds wanneer speelt dit en is er kort ervoor iets gewijzigd (update/wijziging)?");
    q.push("Op hoeveel gebruikers/locaties treedt dit op (impact)?");
    q.push("Welke stappen zijn al geprobeerd en met welk resultaat?");
    return Array.from(new Set(q));
  }

  function handleSuggestionsEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const cid = d.conversation_id ?? d.conversationId ?? null;
    if (cid && cid !== convoIdRef.current) return;
    const list =
      d.suggestions ?? d.items ?? d.list ?? d.payload?.suggestions ?? (Array.isArray(d) ? d : []);
    let out = Array.isArray(list) ? list : [];
    // zorg voor minimaal 3 suggesties
    if (out.length < 3) out = [...out, ...fallbackQuestions(lastContextRef.current)];
    setSuggestions(Array.from(new Set(out)).slice(0, 6));
  }

  function handleAssistEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const cid = d.conversation_id ?? d.conversationId ?? null;
    if (cid && cid !== convoIdRef.current) return;
    const actions =
      d.actions ?? d.nextActions ?? d.nextBestActions ?? d.next_best_actions ?? d.payload?.actions ?? [];
    const steps = d.runbook_steps ?? d.runbook ?? d.steps ?? d.payload?.runbook ?? [];
    if (Array.isArray(actions)) setNextActions(actions);
    if (Array.isArray(steps)) setRunbook(steps);
  }

  async function openStreams() {
    const esSug = api.suggestStream(convoIdRef.current);
    sseSuggestRef.current = esSug;
    esSug.addEventListener("suggestions", (ev: MessageEvent) => { try { handleSuggestionsEvent(ev.data); } catch {} });
    esSug.onmessage = (ev: MessageEvent) => { try { handleSuggestionsEvent(ev.data); } catch {} };

    const esAss = api.assistStream(convoIdRef.current);
    sseAssistRef.current = esAss;
    esAss.addEventListener("assist", (ev: MessageEvent) => { try { handleAssistEvent(ev.data); } catch {} });
    esAss.onmessage = (ev: MessageEvent) => { try { handleAssistEvent(ev.data); } catch {} };

    esSug.onerror = () => {};
    esAss.onerror = () => {};
  }

  async function rebuildTicket(ctx: string) {
    const overrides: TicketOverrides = {
      category: classif.type,
      urgency: classif.urgency,
      impact: classif.impact,
      ci: classif.ci || undefined,
    };
    try {
      const r = await api.ticketSkeleton(convoIdRef.current, ctx, overrides);
      const sk = r.ticket;
      setTicket(sk);
      const ttrMin =
        (typeof sk.ttr_minutes === "number" ? sk.ttr_minutes : undefined) ??
        (typeof sk.ttr_hours === "number" ? sk.ttr_hours * 60 : undefined);
      if (typeof ttrMin === "number") setSlaBadge(`${sk.priority ?? "P4"} · TTR ~${formatTTR(ttrMin)}`);
      else {
        const p = priFromIU(classif.urgency, classif.impact);
        setSlaBadge(`${sk.priority ?? p} · TTR ~${(p === "P1" ? 4 : p === "P2" ? 8 : p === "P3" ? 24 : 48)}u`);
      }
    } catch { /* ignore */ }
  }

  async function startRecording() {
    if (recording) return;
    setSegments([]); setInterim(""); setSuggestions([]); setNextActions([]); setRunbook([]);
    setTicket(null); setCoach(""); setSlaBadge("P4 · TTR ~48u"); setSummary("");
    setClassif((c) => ({ ...c, priority: "P4" }));
    convoIdRef.current = crypto.randomUUID();

    await openStreams();

    const t = await api.wsToken();
    const wsUrl = buildWsUrl(t.token);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onmessage = onWsMessage;
    ws.onopen = async () => {
      try {
        const stop = await startMicPcm16k(ws);
        micStopRef.current = stop;
        setRecording(true);
        lastActivityRef.current = Date.now();
      } catch {
        try { ws.close(1011, "mic_error"); } catch {}
      }
    };
    wsRef.current = ws;
  }

  async function stopRecording() {
    setRecording(false);
    try { await micStopRef.current?.(); } catch {}
    micStopRef.current = null;
    try { wsRef.current?.close(1000, "user_stop"); } catch {}
    wsRef.current = null;
    try { sseSuggestRef.current?.close(); } catch {}
    sseSuggestRef.current = null;
    try { sseAssistRef.current?.close(); } catch {}
    sseAssistRef.current = null;
    if (debounceTicket.current) { window.clearTimeout(debounceTicket.current); debounceTicket.current = null; }
  }

  // watch intake (impact/urgency) → priority
  useEffect(() => {
    setClassif((c) => ({ ...c, priority: priFromIU(c.urgency, c.impact) }));
  }, [classif.urgency, classif.impact]);

  async function doSummarize() {
    const txt = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    try {
      const r = await api.summarize(txt);
      setSummary(r.summary);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
      <section>
        <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0 12px", zIndex: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={recording ? () => void stopRecording() : () => void startRecording()}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: recording ? "#ef4444" : "#111827", color: "white", fontWeight: 700, cursor: "pointer", minWidth: 140 }}
            >
              {recording ? "Stop opname" : "Start opname"}
            </button>

            <span style={{ padding: "6px 10px", borderRadius: 999, background: recording ? "rgba(239,68,68,.1)" : "rgba(17,24,39,.06)", color: recording ? "#ef4444" : "#111827", fontWeight: 600 }}>
              {recording ? "Live…" : "Niet actief"}
            </span>

            <span style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 999, background: "#fff", fontWeight: 700 }}>
              {slaBadge}
            </span>
          </div>

          {coach && (
            <div style={{ marginTop: 8, border: "1px dashed #f59e0b", background: "rgba(245,158,11,0.08)", color: "#92400e", borderRadius: 10, padding: "8px 10px", fontWeight: 600 }}>
              {coach}
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 28, margin: "6px 0 12px" }}>Live Transcriptie</h2>

        <div style={{ display: "grid", gap: 10 }}>
          {segments.length === 0 && !interim ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, color: "#9ca3af", background: "#fff" }}>
              Nog geen tekst…
            </div>
          ) : null}

          {segments.map((s) => (
            <Bubble key={s.id} speaker={s.speaker} text={s.text} dimmed={false} flagged={s.flagged} />
          ))}

          {interim ? <Bubble speaker={"Klant"} text={interim} dimmed flagged={false} /> : null}
        </div>
      </section>

      <RightPanel
        nextActions={nextActions}
        runbook={runbook}
        suggestions={suggestions}
        ticket={ticket}
        classification={classif}
        onClassificationChange={(c) => setClassif((prev) => ({ ...prev, ...c }))}
        onRebuildTicket={() => rebuildTicket(lastContextRef.current)}
        summary={summary}
        onSummarize={doSummarize}
      />
    </div>
  );
}

function Bubble({ speaker, text, dimmed, flagged }: { speaker: "Agent" | "Klant"; text: string; dimmed?: boolean; flagged?: boolean; }) {
  const isAgent = speaker === "Agent";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: isAgent ? "flex-end" : "flex-start" }}>
      {!isAgent && <Badge label="Klant" dark={false} />}
      <div
        style={{ maxWidth: "72ch", whiteSpace: "pre-wrap", border: "1px solid #e5e7eb", background: isAgent ? "#111827" : "#fff", color: isAgent ? "#fff" : "#111827", opacity: dimmed ? 0.6 : 1, padding: "10px 12px", borderRadius: 12, position: "relative" }}
        title={flagged ? "Gevoelige informatie automatisch gemaskeerd (AVG)" : undefined}
      >
        {text}
        {flagged ? (
          <span style={{ position: "absolute", top: 6, right: 8, fontSize: 10, background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "2px 6px" }}>
            PII
          </span>
        ) : null}
      </div>
      {isAgent && <Badge label="Agent" dark />}
    </div>
  );
}

function Badge({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <span style={{ alignSelf: "center", fontSize: 12, fontWeight: 700, color: dark ? "#fff" : "#111827", background: dark ? "#111827" : "rgba(17,24,39,.06)", border: dark ? "1px solid #111827" : "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 999 }}>
      {label}
    </span>
  );
}
