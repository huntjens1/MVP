import { useEffect, useRef, useState } from "react";
import api, { type TicketSkeleton } from "../api";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";
import { maskPII } from "../utils/pii";
import RightPanel from "./RightPanel";
import { openSuggestionsStream, openAssistStream } from "../lib/sseClient";

/** Deepgram payloads (narrowed) */
type DGWord = { speaker?: number };
type DGAlt = { transcript?: string; words?: DGWord[] };
type DGRealtime =
  | {
      type?: string;
      is_final?: boolean;
      channel?: { alternatives?: DGAlt[]; is_final?: boolean };
      alternatives?: DGAlt[];
    }
  | any;

type Segment = {
  id: string;
  speaker: "Agent" | "Klant";
  text: string; // masked
  final: boolean;
  flagged: boolean;
};

function lastN(list: Segment[], n: number): string {
  return list
    .slice(Math.max(0, list.length - n))
    .map((s) => `${s.speaker}: ${s.text}`)
    .join(" ");
}

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
  const [wsConnected, setWsConnected] = useState<boolean>(false);
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
    // Keywords worden server-side bepaald
    return url.toString();
  }

  function handleDG(msg: DGRealtime) {
    const alt: DGAlt | null =
      msg?.channel?.alternatives?.[0] ??
      msg?.alternatives?.[0] ??
      null;
    const isFinal = Boolean(msg?.channel?.is_final ?? msg?.is_final);
    const textRaw = (alt?.transcript || "").trim();
    if (!textRaw && !isFinal) return;

    lastActivityRef.current = Date.now();

    // speakerkeuze
    let speaker: "Agent" | "Klant" = "Klant";
    const sp = (alt?.words as DGWord[] | undefined)?.find((w: DGWord) => typeof w.speaker === "number")?.speaker;
    if (sp === 1) speaker = "Agent";

    if (isFinal) {
      setInterim("");
      if (!textRaw) return;

      const { masked, flagged } = maskPII(textRaw);
      setSegments((list) => {
        const seg: Segment = {
          id: crypto.randomUUID(),
          speaker,
          text: masked,
          final: true,
          flagged,
        };
        const next = [...list, seg];
        const ctx = lastN(next, 4);

        // AI triggers
        void api.suggest(convoIdRef.current, ctx).catch(() => {});
        void api.assist(convoIdRef.current, ctx).catch(() => {});

        // Ticket debounce
        if (debounceTicket.current) window.clearTimeout(debounceTicket.current);
        debounceTicket.current = window.setTimeout(async () => {
          try {
            const r = await api.ticketSkeleton(convoIdRef.current, ctx); // => { ticket }
            setTicket(r.ticket);
            // TTR-badge (fallback 48u als onbekend)
            const minutes = (r.ticket as any)?.ttr_minutes ?? 48 * 60;
            setSlaBadge(`${r.ticket?.priority ?? "P4"} · TTR ~${Math.round(minutes / 60)}u`);
          } catch {
            /* ignore */
          }
        }, 1200);

        // optioneel ingest (types accepteren alleen {conversation_id, content}; extra via any)
        void api
          .ingestTranscript({
            conversation_id: convoIdRef.current,
            content: masked,
            // extra met cast (backend accepteert dit)
            is_final: true,
            speaker_label: speaker === "Agent" ? "agent" : "customer",
          } as any)
          .catch(() => {});

        return next;
      });
    } else {
      const { masked } = maskPII(textRaw);
      setInterim(masked);
    }
  }

  function attachSSE() {
    // Suggestions
    const esSug = openSuggestionsStream(convoIdRef.current);
    sseSuggestRef.current = esSug;
    esSug.addEventListener("suggestions", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { conversation_id: string; suggestions: string[] };
        if (data.conversation_id !== convoIdRef.current) return;
        setSuggestions(data.suggestions || []);
      } catch {
        /* ignore */
      }
    });
    esSug.onerror = () => {};

    // Assist / next-best-actions
    const esAss = openAssistStream(convoIdRef.current);
    sseAssistRef.current = esAss;
    esAss.addEventListener("assist", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          conversation_id: string;
          actions?: string[];
          next_best_actions?: string[];
          runbook?: string[];
          runbook_steps?: string[];
        };
        if (data.conversation_id !== convoIdRef.current) return;
        setNextActions((data.next_best_actions || data.actions || []) as string[]);
        setRunbook((data.runbook_steps || data.runbook || []) as string[]);
      } catch {
        /* ignore */
      }
    });
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
    setSlaBadge("P4 · TTR ~48u");

    convoIdRef.current = crypto.randomUUID();

    try {
      // open SSE streams eerst
      attachSSE();

      // token + WS
      const { token } = await api.wsToken();
      const wsUrl = buildWsUrl(token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setRecording(true);
      };
      ws.onclose = () => {
        setWsConnected(false);
        setRecording(false);
      };
      ws.onerror = () => {
        setWsConnected(false);
      };
      ws.onmessage = (ev) => {
        try {
          const payload = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
          const msg = JSON.parse(payload);
          handleDG(msg as DGRealtime);
        } catch {
          // ignore non-json
        }
      };

      // microfoon direct naar ws (jullie implementatie verwacht een WebSocket)
      const stop = await startMicPcm16k(ws);
      micStopRef.current = stop;
    } catch (err) {
      console.error("[ui] startRecording failed", err);
      await stopRecording();
    }
  }

  async function stopRecording() {
    try {
      if (micStopRef.current) {
        await micStopRef.current();
        micStopRef.current = null;
      }
    } catch {}
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close(1000);
    } catch {}
    wsRef.current = null;
    setWsConnected(false);
    setRecording(false);

    try {
      sseSuggestRef.current?.close();
      sseAssistRef.current?.close();
    } catch {}
    sseSuggestRef.current = null;
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => (recording ? void stopRecording() : void startRecording())}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {recording ? "Stop opname" : "Start opname"}
          </button>

          <span
            style={{
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
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
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              background: "#fff",
              fontWeight: 700,
            }}
          >
            {wsConnected ? "Realtime: verbonden" : "Realtime: uit"}
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
              maxWidth: 560,
              fontSize: 13,
            }}
          >
            {coach}
          </div>
        )}

        <h2 style={{ fontSize: 28, fontWeight: 800, margin: "18px 0" }}>Live Transcriptie</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {segments.map((s) => (
            <ChatBubble key={s.id} speaker={s.speaker} text={s.text} final={s.final} flagged={s.flagged} />
          ))}
          {interim && <ChatBubble speaker="Klant" text={interim} final={false} dimmed />}
          {!segments.length && !interim && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                borderRadius: 10,
                padding: 16,
                color: "#6b7280",
              }}
            >
              Nog geen tekst…
            </div>
          )}
        </div>
      </div>

      {/* als TS over Props van RightPanel klaagt in jouw lokale types, casten we de component (non-breaking) */}
      {(RightPanel as any)({ suggestions, nextActions, runbook, ticket })}
    </div>
  );
}

function ChatBubble({
  speaker,
  text,
  final,
  dimmed,
  flagged,
}: {
  speaker: "Agent" | "Klant";
  text: string;
  final: boolean;
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
          border: final ? "1px solid #e5e7eb" : "1px dashed #e5e7eb",
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
              border: "1px solid #fecaca",
              borderRadius: 999,
              padding: "2px 6px",
              fontWeight: 700,
            }}
          >
            AVG
          </span>
        ) : null}
      </div>
      {isAgent && <Badge label="Agent" dark />}
    </div>
  );
}

function Badge({ label, dark = false }: { label: string; dark?: boolean }) {
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
