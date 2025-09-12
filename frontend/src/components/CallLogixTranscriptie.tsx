// frontend/src/components/CallLogixTranscriptie.tsx
import { useEffect, useRef, useState } from "react";
import api, { type TicketSkeleton } from "../api/index";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";
import { maskPII } from "../utils/pii";

type DGAlt = {
  transcript?: string;
  words?: Array<{ speaker?: number }>;
};
type DGRealtime = {
  channel?: { alternatives?: DGAlt[]; is_final?: boolean };
  alternatives?: DGAlt[];
  is_final?: boolean;
  type?: string;
} | any;

type Segment = {
  id: string;
  speaker: "Agent" | "Klant";
  text: string; // masked
  final: boolean;
  flagged: boolean;
};

import RightPanel from "./RightPanel";

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState<string>("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [runbook, setRunbook] = useState<string[]>([]);
  const [ticket, setTicket] = useState<TicketSkeleton | null>(null);
  const [slaBadge, setSlaBadge] = useState<string>("P4 · TTR ~48u");

  // infra
  const wsRef = useRef<WebSocket | null>(null);
  const micStopRef = useRef<MicStopper | null>(null);
  const convoIdRef = useRef<string>("");
  const sseSuggestRef = useRef<EventSource | null>(null);
  const sseAssistRef = useRef<EventSource | null>(null);
  const debounceTicket = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [coach, setCoach] = useState<string>("");

  useEffect(() => {
    return () => {
      void stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const handleString = (s: string) => {
      try {
        handleDG(JSON.parse(s));
      } catch {
        /* ignore */
      }
    };
    if (typeof ev.data === "string") return handleString(ev.data);
    if (ev.data instanceof ArrayBuffer) {
      const txt = new TextDecoder().decode(new Uint8Array(ev.data));
      return handleString(txt);
    }
    if (ev.data && typeof (ev.data as Blob).text === "function") {
      (ev.data as Blob).text().then(handleString).catch(() => {});
    }
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

          // triggers
          void api.suggest(convoIdRef.current, ctx).catch(() => {});
          void api.assist(convoIdRef.current, ctx).catch(() => {});
          if (debounceTicket.current) window.clearTimeout(debounceTicket.current);
          debounceTicket.current = window.setTimeout(async () => {
            try {
              const r = await api.ticketSkeleton(convoIdRef.current, ctx);
              const sk: any = r?.ticket ?? null; // api normaliseert al naar { ticket }
              if (sk) {
                setTicket(sk);
                const ttrMin =
                  (typeof sk.ttr_minutes === "number" ? sk.ttr_minutes : undefined) ??
                  (typeof sk.ttr_hours === "number" ? sk.ttr_hours * 60 : undefined);
                if (typeof ttrMin === "number") {
                  setSlaBadge(`${sk.priority ?? "P4"} · TTR ~${formatTTR(ttrMin)}`);
                } else {
                  const defHours = priToHours(String(sk.priority ?? "P4"));
                  setSlaBadge(`${sk.priority ?? "P4"} · TTR ~${defHours}u`);
                }
              }
            } catch {
              /* ignore */
            }
          }, 1200);

          return next;
        });
      }
    } else {
      const { masked } = maskPII(textRaw);
      setInterim(masked);
    }
  }

  function priToHours(p: string) {
    const map: Record<string, number> = { P1: 4, P2: 8, P3: 24, P4: 48 };
    return map[p] ?? 48;
  }
  function formatTTR(mins: number) {
    if (mins % 60 === 0) return `${Math.round(mins / 60)}u`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}u${m}m` : `${m}m`;
  }
  function lastN(list: Segment[], n: number) {
    return list.slice(-n).map((s) => `${s.speaker}: ${s.text}`).join("\n");
  }

  // ---------- SSE (robust handlers) ----------
  function parseJSON(raw: any) {
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }
  function handleSuggestionsEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const cid = d.conversation_id ?? d.conversationId ?? null;
    if (cid && cid !== convoIdRef.current) return; // accepteer ook payloads zonder cid
    const list =
      d.suggestions ??
      d.items ??
      d.list ??
      d.payload?.suggestions ??
      (Array.isArray(d) ? d : []);
    if (Array.isArray(list)) setSuggestions(list);
  }
  function handleAssistEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const cid = d.conversation_id ?? d.conversationId ?? null;
    if (cid && cid !== convoIdRef.current) return;
    const actions =
      d.actions ??
      d.nextActions ??
      d.nextBestActions ??
      d.next_best_actions ??
      d.payload?.actions ??
      [];
    const steps =
      d.runbook_steps ??
      d.runbook ??
      d.steps ??
      d.payload?.runbook ??
      [];
    if (Array.isArray(actions)) setNextActions(actions);
    if (Array.isArray(steps)) setRunbook(steps);
  }

  async function openStreams() {
    const esSug = api.suggestStream(convoIdRef.current);
    sseSuggestRef.current = esSug;
    esSug.addEventListener("suggestions", (ev: MessageEvent) => {
      try { handleSuggestionsEvent(ev.data); } catch {}
    });
    esSug.onmessage = (ev: MessageEvent) => {
      try { handleSuggestionsEvent(ev.data); } catch {}
    };
    esSug.onerror = () => {};

    const esAss = api.assistStream(convoIdRef.current);
    sseAssistRef.current = esAss;
    esAss.addEventListener("assist", (ev: MessageEvent) => {
      try { handleAssistEvent(ev.data); } catch {}
    });
    esAss.onmessage = (ev: MessageEvent) => {
      try { handleAssistEvent(ev.data); } catch {}
    };
    esAss.onerror = () => {};
  }

  async function startRecording() {
    if (recording) return;
    setSegments([]);
    setInterim("");
    setSuggestions([]);
    setNextActions([]);
    setRunbook([]);
    setTicket(null);
    setCoach("");
    setSlaBadge("P4 · TTR ~48u");
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
        try {
          wsRef.current?.close(1000, 'user_stop');
      } catch {
        /* ignore */
      }
      }
    };
    wsRef.current = ws;
  }

  async function stopRecording() {
    setRecording(false);
    try {
      await micStopRef.current?.();
    } catch {}
    micStopRef.current = null;
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    try {
      sseSuggestRef.current?.close();
    } catch {}
    sseSuggestRef.current = null;
    try {
      sseAssistRef.current?.close();
    } catch {}
    sseAssistRef.current = null;
    if (debounceTicket.current) {
      window.clearTimeout(debounceTicket.current);
      debounceTicket.current = null;
    }
  }

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey)) return;
      if (e.code === "KeyS") {
        e.preventDefault();
        recording ? void stopRecording() : void startRecording();
      }
      if (e.code === "KeyD") {
        e.preventDefault();
        navigator.clipboard.writeText(segments.map((s) => s.text).join(" ").slice(0, 4000));
      }
      if (e.code === "KeyK") {
        e.preventDefault();
        if (suggestions[0]) navigator.clipboard.writeText(suggestions[0]);
      }
      if (e.code === "KeyN") {
        e.preventDefault();
        if (nextActions[0]) navigator.clipboard.writeText(nextActions[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, segments, suggestions, nextActions]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
      <section>
        <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0 12px", zIndex: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={recording ? () => void stopRecording() : () => void startRecording()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: recording ? "#ef4444" : "#111827",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                minWidth: 140,
              }}
            >
              {recording ? "Stop opname" : "Start opname"}
            </button>

            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: recording ? "rgba(239,68,68,.1)" : "rgba(17,24,39,.06)",
                color: recording ? "#ef4444" : "#111827",
                fontWeight: 600,
              }}
            >
              {recording ? "Live…" : "Niet actief"}
            </span>

            <span
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                background: "#fff",
                fontWeight: 700,
              }}
            >
              {slaBadge}
            </span>
          </div>

          {coach && (
            <div
              style={{
                marginTop: 8,
                border: "1px dashed #f59e0b",
                background: "rgba(245,158,11,0.08)",
                color: "#92400e",
                borderRadius: 10,
                padding: "8px 10px",
                fontWeight: 600,
              }}
            >
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

      <RightPanel nextActions={nextActions} runbook={runbook} suggestions={suggestions} ticket={ticket} />
    </div>
  );
}

function Bubble({
  speaker,
  text,
  dimmed,
  flagged,
}: {
  speaker: "Agent" | "Klant";
  text: string;
  dimmed?: boolean;
  flagged?: boolean;
}) {
  const isAgent = speaker === "Agent";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: isAgent ? "flex-end" : "flex-start" }}>
      {!isAgent && <Badge label="Klant" dark={false} />}
      <div
        style={{
          maxWidth: "72ch",
          whiteSpace: "pre-wrap",
          border: "1px solid #e5e7eb",
          background: isAgent ? "#111827" : "#fff",
          color: isAgent ? "#fff" : "#111827",
          opacity: dimmed ? 0.6 : 1,
          padding: "10px 12px",
          borderRadius: 12,
          position: "relative",
        }}
        title={flagged ? "Gevoelige informatie automatisch gemaskeerd (AVG)" : undefined}
      >
        {text}
        {flagged ? (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              fontSize: 10,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
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
    <span
      style={{
        alignSelf: "center",
        fontSize: 12,
        fontWeight: 700,
        color: dark ? "#fff" : "#111827",
        background: dark ? "#111827" : "rgba(17,24,39,.06)",
        border: dark ? "1px solid #111827" : "1px solid #e5e7eb",
        padding: "4px 8px",
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}
