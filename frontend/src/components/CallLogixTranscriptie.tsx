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

  function speakerLabel(speaker: number | null | undefined) {
    return speaker === 0 ? "Agent" : "Gebruiker";
  }

  // Open SSE zodra we een wsToken hebben (token in query, geen cookies nodig)
  useEffect(() => {
    if (!wsToken) return;
    if (sseStopRef.current) {
      try { sseStopRef.current(); } catch {}
      sseStopRef.current = null;
    }
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/stream/suggestions?conversation_id=${conversationId}&token=${encodeURIComponent(
      wsToken
    )}`;
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

  // Kies runtime een ondersteund container/codec-combinatie (Chrome/Edge: webm; Safari: recorder vaak afwezig)
  function pickSupportedMime(): string | null {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/webm",
    ];
    if (typeof (window as any).MediaRecorder === "undefined") return null;
    for (const t of candidates) {
      try {
        if ((window as any).MediaRecorder.isTypeSupported?.(t)) return t;
      } catch {}
    }
    return null;
  }

  const startRecording = async () => {
    setTranscript([]);
    setInterim("");
    setSuggestions([]);
    setRecording(true);

    const { token } = await api.wsToken();
    setWsToken(token);

    const base = import.meta.env.VITE_API_BASE_URL;
    const wsBase = base.replace(/^http/i, "ws");
    const wsUrl = `${wsBase}/ws/mic?conversation_id=${conversationId}&token=${encodeURIComponent(token)}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      navigator.mediaDevices
        .getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } })
        .then((stream) => {
          const mimeType = pickSupportedMime();
          if (!mimeType) {
            console.error("MediaRecorder/Opus niet ondersteund door deze browser.");
            alert("Opname wordt niet ondersteund door deze browser. Probeer Chrome/Edge desktop.");
            return;
          }
          console.info("Gebruik opnameformaat:", mimeType);
          const mr = new MediaRecorder(stream, { mimeType });
          mr.ondataavailable = async (e) => {
            if (e.data.size > 0 && wsRef.current?.readyState === 1) {
              const buf = await e.data.arrayBuffer();
              wsRef.current.send(buf);
            }
          };
          mr.start(250);
          wsRef.current!.onclose = () => {
            try { mr.stop(); } catch {}
            stream.getTracks().forEach((t) => t.stop());
          };
        })
        .catch((err) => {
          console.error("getUserMedia error", err);
          alert("Microfoon toegang geweigerd of niet beschikbaar.");
        });
    };

    // Deepgram JSON events → transcript
    wsRef.current.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        // console.log("DG:", json); // eventueel tijdelijk aanzetten
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
      } catch {
        // non‑JSON ping negeren
      }
    };
  };

  const stopRecording = () => {
    setRecording(false);
    wsRef.current?.close();
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
            {transcript.length === 0 && (
              <div className="opacity-60 italic">Nog geen transcriptie...</div>
            )}
            {transcript.map((regel, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl p-4 bg-green-100"
                   style={{ maxWidth: "90%", alignSelf: "flex-start" }}>
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono">{regel}</span>
              </div>
            ))}
            {interim && (
              <div className="flex items-start gap-3 rounded-2xl p-4 border-dashed border-2 opacity-70 border-green-400"
                   style={{ maxWidth: "90%", alignSelf: "flex-start" }}>
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono animate-pulse">{interim}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6 justify-center">
            <button
              className={`px-5 py-2 rounded-xl font-bold ${recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"}`}
              onClick={startRecording}
              disabled={recording}
            >
              ● Start
            </button>
            <button
              className={`px-5 py-2 rounded-xl font-bold ${!recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"}`}
              onClick={stopRecording}
              disabled={!recording}
            >
              ■ Stop
            </button>
          </div>
        </section>

        <aside className="w-full sm:w-80 rounded-3xl p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6">AI Vraagsuggesties</h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && (
              <li className="opacity-40">Nog geen suggesties...</li>
            )}
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
