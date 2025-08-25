import { useRef, useState, useEffect } from "react";
import api from "../api";
import { makeEventStream } from "../lib/eventStream";

function SuggestionFeedback({
  suggestion,
  conversationId,
}: {
  suggestion: { id?: string; text: string };
  conversationId: string;
}) {
  const [feedback, setFeedback] = useState<null | "good" | "bad">(null);
  async function send(rating: "good" | "bad") {
    setFeedback(rating);
    try {
      await api.feedback({
        suggestion_id: suggestion.id,
        suggestion_text: suggestion.text,
        conversation_id: conversationId,
        feedback: rating === "good" ? 1 : -1,
      });
    } catch {
      alert("Feedback opslaan mislukt!");
    }
  }
  return (
    <div className="flex items-center gap-3 my-1">
      <span className="flex-1">{suggestion.text}</span>
      <button
        className={`px-2 py-1 rounded-lg ${feedback === "good" ? "bg-green-600 text-white" : "bg-gray-200"}`}
        disabled={!!feedback}
        onClick={() => send("good")}
      >
        👍 Goed
      </button>
      <button
        className={`px-2 py-1 rounded-lg ${feedback === "bad" ? "bg-red-600 text-white" : "bg-gray-200"}`}
        disabled={!!feedback}
        onClick={() => send("bad")}
      >
        👎 Niet bruikbaar
      </button>
      {feedback && <span className="text-green-600 ml-3">Feedback ontvangen!</span>}
    </div>
  );
}

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [suggestions, setSuggestions] = useState<{ id?: string; text: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const sseStopRef = useRef<null | (() => void)>(null);
  const lastSuggestionSentRef = useRef("");
  const [conversationId] = useState(() => crypto.randomUUID());
  const [wsToken, setWsToken] = useState<string | null>(null);

  // interne refs voor fallback
  const receivedAnyRef = useRef(false);
  const stopMediaRecorderRef = useRef<null | (() => void)>(null);
  const cleanupPcmRef = useRef<null | (() => void)>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  function speakerLabel(speaker: number | null | undefined) {
    return speaker === 0 ? "Agent" : "Gebruiker";
  }

  // SSE openen met token
  useEffect(() => {
    if (!wsToken) return;
    if (sseStopRef.current) {
      try { sseStopRef.current(); } catch {}
      sseStopRef.current = null;
    }
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/stream/suggestions?conversation_id=${conversationId}&token=${encodeURIComponent(wsToken)}`;
    sseStopRef.current = makeEventStream(url, (type, data) => {
      if (type === "suggestions" && data?.suggestions) {
        setSuggestions(data.suggestions.map((t: string) => ({ text: t })));
      }
    });
    return () => {
      if (sseStopRef.current) {
        try { sseStopRef.current(); } catch {}
        sseStopRef.current = null;
      }
    };
  }, [conversationId, wsToken]);

  async function getSuggestions(currentTranscript: string) {
    if (!currentTranscript.trim() || currentTranscript.trim() === lastSuggestionSentRef.current) return;
    lastSuggestionSentRef.current = currentTranscript.trim();
    try {
      const data = await api.suggestOnDemand(currentTranscript);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {}
  }

  // pick beste container voor Opus
  function pickOpusMime(): string | null {
    const cands = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
    const MR: any = (window as any).MediaRecorder;
    if (!MR) return null;
    for (const t of cands) if (MR.isTypeSupported?.(t)) return t;
    return null;
  }

  // ---- PCM pipeline (fallback) ----
  async function startPCM(ws: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const source = audioCtx.createMediaStreamSource(stream);
    const proc = audioCtx.createScriptProcessor(4096, 1, 1);
    source.connect(proc);
    proc.connect(audioCtx.destination);

    function floatTo16BitPCM(input: Float32Array) {
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return buffer;
    }
    function downsample(buffer: Float32Array, inRate = 48000, outRate = 16000) {
      if (inRate === outRate) return buffer;
      const ratio = inRate / outRate;
      const newLen = Math.round(buffer.length / ratio);
      const out = new Float32Array(newLen);
      let oi = 0, ii = 0;
      while (oi < newLen) { out[oi++] = buffer[Math.floor(ii)]; ii += ratio; }
      return out;
    }

    proc.onaudioprocess = (e) => {
      if (ws.readyState !== 1) return;
      const input = e.inputBuffer.getChannelData(0);
      const ds = downsample(input, 48000, 16000);
      const pcm = floatTo16BitPCM(ds);
      ws.send(pcm);
    };

    cleanupPcmRef.current = () => {
      try { proc.disconnect(); source.disconnect(); } catch {}
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      try { audioCtx.close(); } catch {}
      cleanupPcmRef.current = null;
    };
  }

  const startRecording = async () => {
    setTranscript([]); setInterim(""); setSuggestions([]); setRecording(true);
    receivedAnyRef.current = false;

    const { token } = await api.wsToken();
    setWsToken(token);

    const base = import.meta.env.VITE_API_BASE_URL;
    const wsBase = base.replace(/^http/i, "ws");

    // 1) Probeer eerst OPUS (codec=opus)
    const opusUrl = `${wsBase}/ws/mic?conversation_id=${conversationId}&token=${encodeURIComponent(token)}&codec=opus`;
    wsRef.current = new WebSocket(opusUrl);

    wsRef.current.onopen = async () => {
      const mime = pickOpusMime();
      if (!mime) {
        // geen MediaRecorder -> direct PCM fallback
        wsRef.current?.close();
        await startWithPCM(token, wsBase);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
        const mr = new MediaRecorder(stream, { mimeType: mime });
        mr.ondataavailable = async (e) => {
          if (e.data.size > 0 && wsRef.current?.readyState === 1) {
            const buf = await e.data.arrayBuffer();
            wsRef.current.send(buf);
          }
        };
        mr.start(250);
        stopMediaRecorderRef.current = () => {
          try { mr.stop(); } catch {}
          try { stream.getTracks().forEach(t => t.stop()); } catch {}
          stopMediaRecorderRef.current = null;
        };
      } catch (err) {
        // getUserMedia faalt -> direct PCM fallback
        wsRef.current?.close();
        await startWithPCM(token, wsBase);
        return;
      }

      // Fallback naar PCM indien Deepgram 0 JSON terugstuurt in 5s
      fallbackTimerRef.current = window.setTimeout(async () => {
        if (!receivedAnyRef.current) {
          try { stopMediaRecorderRef.current?.(); } catch {}
          try { wsRef.current?.close(); } catch {}
          await startWithPCM(token, wsBase);
        }
      }, 5000);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        receivedAnyRef.current = true; // we krijgen iets terug
        const alt = json?.channel?.alternatives?.[0];
        if (alt?.transcript !== undefined) {
          const tekst = alt.transcript?.trim() || "";
          if (json.is_final && tekst) {
            setTranscript((prev) => {
              const regel = `${speakerLabel(0)}: ${tekst}`;
              const nieuw = [...prev, regel];
              getSuggestions(nieuw.join("\n"));
              return nieuw;
            });
            setInterim("");
          } else if (!json.is_final) {
            setInterim(tekst ? `${speakerLabel(0)}: ${tekst}` : "");
          }
        }
      } catch { /* non-JSON pings negeren */ }
    };
  };

  // start met PCM fallback
  async function startWithPCM(token: string, wsBase: string) {
    const pcmUrl = `${wsBase}/ws/mic?conversation_id=${conversationId}&token=${encodeURIComponent(token)}&codec=linear16`;
    wsRef.current = new WebSocket(pcmUrl);
    wsRef.current.onopen = async () => { await startPCM(wsRef.current!); };
    wsRef.current.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        const alt = json?.channel?.alternatives?.[0];
        if (alt?.transcript !== undefined) {
          const tekst = alt.transcript?.trim() || "";
          if (json.is_final && tekst) {
            setTranscript((prev) => {
              const regel = `${speakerLabel(0)}: ${tekst}`;
              const nieuw = [...prev, regel];
              getSuggestions(nieuw.join("\n"));
              return nieuw;
            });
            setInterim("");
          } else if (!json.is_final) {
            setInterim(tekst ? `${speakerLabel(0)}: ${tekst}` : "");
          }
        }
      } catch {}
    };
  }

  const stopRecording = () => {
    setRecording(false);
    if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
    try { stopMediaRecorderRef.current?.(); } catch {}
    try { cleanupPcmRef.current?.(); } catch {}
    try { wsRef.current?.close(); } catch {}
    if (sseStopRef.current) {
      try { sseStopRef.current(); } catch {}
      sseStopRef.current = null;
    }
  };

  return (
    <main className="min-h-screen px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        <section className="flex-1 rounded-3xl p-8 flex flex-col">
          <header className="mb-8">
            <h2 className="text-3xl font-black">Live Transcriptie</h2>
          </header>
          <div className="flex-1 flex flex-col rounded-xl min-h-[160px] p-2 md:p-6 gap-2">
            {transcript.length === 0 && <div className="opacity-60 italic">Nog geen transcriptie...</div>}
            {transcript.map((regel, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl p-4 bg-green-100" style={{ maxWidth: "90%", alignSelf: "flex-start" }}>
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono">{regel}</span>
              </div>
            ))}
            {interim && (
              <div className="flex items-start gap-3 rounded-2xl p-4 border-dashed border-2 opacity-70 border-green-400" style={{ maxWidth: "90%", alignSelf: "flex-start" }}>
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono animate-pulse">{interim}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6 justify-center">
            <button className={`px-5 py-2 rounded-xl font-bold ${recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"}`} onClick={startRecording} disabled={recording}>
              ● Start
            </button>
            <button className={`px-5 py-2 rounded-xl font-bold ${!recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"}`} onClick={stopRecording} disabled={!recording}>
              ■ Stop
            </button>
          </div>
        </section>

        <aside className="w-full sm:w-80 rounded-3xl p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6">AI Vraagsuggesties</h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && <li className="opacity-40">Nog geen suggesties...</li>}
            {suggestions.map((s, i) => (
              <li key={i} className="rounded-2xl p-4 border">
                <SuggestionFeedback suggestion={s} conversationId={conversationId} />
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
