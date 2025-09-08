// frontend/src/components/CallLogixTranscriptie.tsx
import { useEffect, useRef, useState } from "react";
import api from "../api";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";

/** ===== Types die meerdere Deepgram-vormen afdekken ===== */
type DGAlt = {
  transcript?: string;
  confidence?: number;
  words?: Array<{
    word?: string;
    start?: number;
    end?: number;
    speaker?: number; // aanwezig bij diarization
  }>;
};

type DGRealtime =
  | {
      type?: string; // "Results" | "UtteranceEnd" | ...
      channel?: { alternatives?: DGAlt[]; is_final?: boolean };
      alternatives?: DGAlt[];
      is_final?: boolean;
    }
  | Record<string, unknown>;

type Segment = {
  id: string;
  speaker: "Agent" | "Klant";
  text: string;
  final: boolean;
};

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState<string>("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micStopRef = useRef<MicStopper | null>(null);
  const convoIdRef = useRef<string>("");

  // ===== Cleanup =====
  useEffect(() => {
    return () => { void stopRecording(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Helpers =====
  function buildWsUrl(token: string) {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const wssBase = base.replace(/^http/i, "ws");
    const url = new URL(`${wssBase}/ws/mic`);
    url.searchParams.set("conversation_id", convoIdRef.current);
    url.searchParams.set("token", token);

    // realtime-compatibele params
    url.searchParams.set("codec", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("language", "nl");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("diarize", "true");
    return url.toString();
  }

  function lastNText(n = 3) {
    const pick = segments.slice(-n).map(s => `${s.speaker}: ${s.text}`);
    return pick.join("\n");
  }

  /** Robuust: accepteert string, Blob, ArrayBuffer */
  function onWsMessage(ev: MessageEvent) {
    const handleString = (s: string) => {
      try {
        const msg: DGRealtime = JSON.parse(s);
        handleDG(msg);
      } catch { /* ignore */ }
    };
    if (typeof ev.data === "string") {
      handleString(ev.data);
    } else if (ev.data instanceof ArrayBuffer) {
      const txt = new TextDecoder().decode(new Uint8Array(ev.data));
      handleString(txt);
    } else if (ev.data && typeof (ev.data as Blob).text === "function") {
      (ev.data as Blob).text().then(handleString).catch(() => {});
    }
  }

  /** Extract transcript + speaker en update UI (+ trigger suggesties) */
  async function handleDG(msg: DGRealtime) {
    const isFinal = Boolean(
      (msg as any)?.channel?.is_final ?? (msg as any)?.is_final ?? false
    );

    const alt: DGAlt | undefined =
      (msg as any)?.channel?.alternatives?.[0] ??
      (msg as any)?.alternatives?.[0];

    const text = (alt?.transcript || "").trim();
    if (!text && !isFinal) return;

    // simpele speaker-herleiding op basis van diarization-woorden
    let speaker: "Agent" | "Klant" = "Klant";
    const sp = alt?.words?.find((w) => typeof w.speaker === "number")?.speaker;
    if (sp === 1) speaker = "Agent";
    if (sp === 2) speaker = "Klant";

    if (isFinal) {
      setInterim("");
      if (text) {
        setSegments((list) => {
          const next = [...list, { id: crypto.randomUUID(), speaker, text, final: true }];
          // na commit: stuur prompt naar suggesties
          void sendSuggestions(`${lastNFrom(next, 2)}\n${speaker}: ${text}`);
          return next;
        });
      }
    } else {
      setInterim(text);
    }
  }

  function lastNFrom(list: Segment[], n: number) {
    return list.slice(-n).map(s => `${s.speaker}: ${s.text}`).join("\n");
  }

  async function openSuggestionsStream() {
    const base = import.meta.env.VITE_API_BASE_URL as string;
    const url = `${base}/api/suggest/stream?conversation_id=${encodeURIComponent(convoIdRef.current)}`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener("suggestions", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload?.conversation_id !== convoIdRef.current) return;
        const items: string[] = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        if (items.length) setSuggestions(items);
      } catch {/* noop */}
    });
    es.onerror = () => { /* laat SSE reconnecten */ };
    sseRef.current = es;
  }

  async function sendSuggestions(context: string) {
    try {
      const base = import.meta.env.VITE_API_BASE_URL as string;
      await fetch(`${base}/api/suggest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convoIdRef.current,
          text: context || lastNText(3),
        }),
      });
      // antwoord komt via SSE binnen; niets doen hier
    } catch (e) {
      console.warn("[suggest]", (e as Error).message);
    }
  }

  // ===== Start / Stop =====
  async function startRecording() {
    if (recording) return;
    setSegments([]);
    setInterim("");
    setSuggestions([]);
    convoIdRef.current = crypto.randomUUID();

    // SSE voor suggesties openen vóór audio start
    await openSuggestionsStream();

    const t = await api.wsToken();
    const wsUrl = buildWsUrl(t.token);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onmessage = onWsMessage;
    ws.onerror = () => {};
    ws.onclose  = () => {};
    ws.onopen = async () => {
      try {
        const stop = await startMicPcm16k(ws, { onError: (e) => console.warn("[mic]", e.message) });
        micStopRef.current = stop;
        setRecording(true);
      } catch (e) {
        console.error(e);
        try { ws.close(); } catch {}
      }
    };

    wsRef.current = ws;
  }

  async function stopRecording() {
    setRecording(false);
    try { await micStopRef.current?.(); } catch {}
    micStopRef.current = null;
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { sseRef.current?.close(); } catch {}
    sseRef.current = null;
  }

  // ===== UI =====
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
      {/* Content */}
      <section>
        {/* Controls */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "#fff",
            padding: "8px 0 16px",
            zIndex: 5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          </div>
        </div>

        {/* Transcript */}
        <h2 style={{ fontSize: 28, margin: "6px 0 12px" }}>Live Transcriptie</h2>

        <div style={{ display: "grid", gap: 10 }}>
          {segments.length === 0 && !interim ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                color: "#9ca3af",
                background: "#fff",
              }}
            >
              Nog geen tekst…
            </div>
          ) : null}

          {segments.map((s) => (
            <Bubble key={s.id} speaker={s.speaker} text={s.text} />
          ))}

          {interim ? <Bubble speaker={"Klant"} text={interim} dimmed /> : null}
        </div>
      </section>

      {/* Suggesties */}
      <aside>
        <h3 style={{ fontSize: 18, margin: "4px 0 12px" }}>AI Vraagsuggesties</h3>
        {suggestions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>Nog geen suggesties…</div>
        ) : (
          <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
            {suggestions.map((s, i) => (
              <li key={i}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#fff",
                    padding: "10px 12px",
                    lineHeight: 1.35,
                  }}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/** Speech bubble per speaker */
function Bubble({
  speaker,
  text,
  dimmed,
}: {
  speaker: "Agent" | "Klant";
  text: string;
  dimmed?: boolean;
}) {
  const isAgent = speaker === "Agent";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        justifyContent: isAgent ? "flex-end" : "flex-start",
      }}
    >
      {!isAgent && <Badge label="Klant" />}
      <div
        style={{
          maxWidth: "70ch",
          whiteSpace: "pre-wrap",
          border: "1px solid #e5e7eb",
          background: isAgent ? "#111827" : "#fff",
          color: isAgent ? "#fff" : "#111827",
          opacity: dimmed ? 0.6 : 1,
          padding: "10px 12px",
          borderRadius: 12,
        }}
      >
        {text}
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
        color: dark ? "#111827" : "#111827",
        background: "rgba(17,24,39,.06)",
        border: "1px solid #e5e7eb",
        padding: "4px 8px",
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}
