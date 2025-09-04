import { useEffect, useRef, useState } from "react";
import api from "../api";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";

type DGMessage = {
  type?: string;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
    is_final?: boolean;
  };
  is_final?: boolean;
  alternatives?: Array<{ transcript?: string }>;
};

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interim, setInterim] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const micStopRef = useRef<MicStopper | null>(null);
  const convoIdRef = useRef<string>("");

  // ✅ cleanup mag geen Promise teruggeven → Promise negeren met `void`
  useEffect(() => {
    return () => {
      void stopRecording(); // opruimen bij unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildWsUrl(token: string) {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const wssBase = base.replace(/^http/i, "ws");
    const url = new URL(`${wssBase}/ws/mic`);
    url.searchParams.set("conversation_id", convoIdRef.current);
    url.searchParams.set("token", token);
    url.searchParams.set("codec", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("language", "nl");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("punctuate", "true");
    return url.toString();
  }

  function handleDGMessage(ev: MessageEvent) {
    try {
      const msg: DGMessage = typeof ev.data === "string" ? JSON.parse(ev.data) : null;
      if (!msg) return;

      const alt = msg.channel?.alternatives?.[0] ?? msg.alternatives?.[0];
      const text = (alt?.transcript || "").trim();
      const isFinal = (msg.channel?.is_final ?? msg.is_final) === true;

      if (isFinal) {
        if (text) setTranscript((t) => (t ? t + "\n" + text : text));
        setInterim("");
      } else {
        setInterim(text);
      }
    } catch {
      // non-JSON berichten negeren
    }
  }

  async function startRecording() {
    if (recording) return;
    setTranscript("");
    setInterim("");
    convoIdRef.current = crypto.randomUUID();

    const t = await api.wsToken();
    const wsUrl = buildWsUrl(t.token);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onmessage = handleDGMessage;
    ws.onerror = () => {};
    ws.onclose = () => {};
    ws.onopen = async () => {
      try {
        const stop = await startMicPcm16k(ws, {
          onError: (e) => console.warn("[mic]", e.message),
        });
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
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={recording ? () => void stopRecording() : () => void startRecording()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: recording ? "#ef4444" : "#111827",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {recording ? "Stop opname" : "Start opname"}
          </button>
          <span style={{ opacity: 0.6 }}>
            {recording ? "Live..." : "Niet actief"}
          </span>
        </div>

        <h2 style={{ fontSize: 28, margin: "12px 0" }}>Live Transcriptie</h2>

        <div
          style={{
            whiteSpace: "pre-wrap",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 16,
            minHeight: 220,
            fontSize: 16,
            lineHeight: 1.5,
            background: "#fff",
          }}
        >
          {transcript || <span style={{ opacity: 0.5 }}>Nog geen tekst...</span>}
          {interim ? <span style={{ opacity: 0.5 }}> {interim}</span> : null}
        </div>
      </section>

      <aside>
        <h3 style={{ fontSize: 18, margin: "4px 0 12px" }}>AI Vraagsuggesties</h3>
        <div style={{ opacity: 0.6 }}>Nog geen suggesties…</div>
      </aside>
    </div>
  );
}
