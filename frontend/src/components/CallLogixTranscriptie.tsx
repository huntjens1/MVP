import { useEffect, useRef, useState } from "react";
import api from "../api/index";

/* ----------------------------- Types ----------------------------- */
type VSug = { id: string; text: string; pinned?: boolean; shownAt: number };

const TTL_MS = 20000;        // Suggestie blijft min. 20s zichtbaar
const REFRESH_MS = 3000;     // Elke 3s evalueren

/* ----------------------------- Suggestiekaart ----------------------------- */
function SuggestionCard({
  suggestion,
  onPinToggle,
  onUsed,
  conversationId,
}: {
  suggestion: VSug;
  onPinToggle: (id: string) => void;
  onUsed: (id: string) => void;
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
      /* ignore */
    }
  }

  return (
    <div className="rounded-2xl p-4 border flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span>{suggestion.text}</span>
        <button
          className="ml-2 text-sm text-blue-600"
          onClick={() => onPinToggle(suggestion.id)}
        >
          {suggestion.pinned ? "📌 Unpin" : "📌 Pin"}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          className={`px-2 py-1 rounded ${
            feedback === "good" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
          disabled={!!feedback}
          onClick={() => send("good")}
        >
          👍 Goed
        </button>
        <button
          className={`px-2 py-1 rounded ${
            feedback === "bad" ? "bg-red-600 text-white" : "bg-gray-200"
          }`}
          disabled={!!feedback}
          onClick={() => send("bad")}
        >
          👎 Niet bruikbaar
        </button>
        <button
          className="ml-auto text-xs text-gray-600"
          onClick={() => onUsed(suggestion.id)}
        >
          ✅ Gebruikt
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Review Modal ----------------------------- */
function ReviewModal({
  open,
  onClose,
  summary,
  askedQuestions,
  shownSuggestions,
  conversationId,
}: {
  open: boolean;
  onClose: () => void;
  summary: string;
  askedQuestions: string[];
  shownSuggestions: VSug[];
  conversationId: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
      <div className="bg-white p-6 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Call Review</h2>

        <h3 className="font-semibold mb-2">Samenvatting</h3>
        <p className="mb-4 whitespace-pre-line">{summary}</p>

        <h3 className="font-semibold mb-2">Gestelde vragen</h3>
        <ul className="mb-4 space-y-2">
          {askedQuestions.map((q, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{q}</span>
              <div className="flex gap-2">
                <button
                  className="px-2 bg-green-200"
                  onClick={() =>
                    api.feedback({
                      conversation_id: conversationId,
                      suggestion_text: q,
                      feedback: 1,
                    })
                  }
                >
                  👍
                </button>
                <button
                  className="px-2 bg-red-200"
                  onClick={() =>
                    api.feedback({
                      conversation_id: conversationId,
                      suggestion_text: q,
                      feedback: -1,
                    })
                  }
                >
                  👎
                </button>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="font-semibold mb-2">Getoonde AI-suggesties</h3>
        <ul className="space-y-2">
          {shownSuggestions.map((s, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{s.text}</span>
              <div className="flex gap-2">
                <button
                  className="px-2 bg-green-200"
                  onClick={() =>
                    api.feedback({
                      conversation_id: conversationId,
                      suggestion_text: s.text,
                      feedback: 1,
                    })
                  }
                >
                  👍
                </button>
                <button
                  className="px-2 bg-red-200"
                  onClick={() =>
                    api.feedback({
                      conversation_id: conversationId,
                      suggestion_text: s.text,
                      feedback: -1,
                    })
                  }
                >
                  👎
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button className="px-4 py-2 bg-black text-white rounded" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Main Component ----------------------------- */
export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interim, setInterim] = useState("");

  const [conversationId] = useState(() => crypto.randomUUID());

  const wsRef = useRef<WebSocket | null>(null);
  const cleanupPcmRef = useRef<null | (() => void)>(null);

  // Suggesties
  const [, setSuggestionPool] = useState<VSug[]>([]); // alleen setter nodig
  const [visibleSuggestions, setVisibleSuggestions] = useState<VSug[]>([]);
  const lastSuggestionSentRef = useRef("");

  // Review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [shownSuggestions, setShownSuggestions] = useState<VSug[]>([]);

  /* ----------------------------- Suggestion logic ----------------------------- */

  function ingestSuggestions(items: string[]) {
    const now = Date.now();
    const add: VSug[] = items
      .filter((t) => t && t.trim())
      .map((t) => ({ id: crypto.randomUUID(), text: t.trim(), shownAt: now }));
    setSuggestionPool((prev) => [...prev, ...add]);
  }

  function pinToggle(id: string) {
    setVisibleSuggestions((v) =>
      v.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
    );
  }
  function markUsed(id: string) {
    setVisibleSuggestions((v) => v.filter((s) => s.id !== id));
  }

  useEffect(() => {
    const t = setInterval(() => {
      setVisibleSuggestions((vis) => {
        const now = Date.now();
        let next = vis.filter((v) => v.pinned || now - v.shownAt < TTL_MS);
        setSuggestionPool((pool) => {
          let p = [...pool];
          while (next.length < 3 && p.length > 0) {
            const cand = p.shift()!;
            next.push({ ...cand, shownAt: now });
          }
          return p;
        });
        return next;
      });
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  async function getSuggestions(currentTranscript: string) {
    const msg = currentTranscript.trim();
    if (!msg || msg === lastSuggestionSentRef.current) return;
    lastSuggestionSentRef.current = msg;
    try {
      const data = await api.suggestOnDemand(msg);
      ingestSuggestions((data?.suggestions ?? []) as string[]);
    } catch {
      /* ignore */
    }
  }

  /* ----------------------------- ASR handling ----------------------------- */

  async function normalizeWsText(data: string | Blob | ArrayBuffer) {
    try {
      if (typeof data === "string") return data;
      if (data instanceof Blob) return await data.text();
      if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
    } catch {}
    return null;
  }

  function handleAsrJson(text: string) {
    try {
      const json = JSON.parse(text);
      const alt = json?.channel?.alternatives?.[0];
      if (alt?.transcript !== undefined) {
        const t = alt.transcript?.trim() || "";
        if (json.is_final && t) {
          setTranscript((prev) => {
            const regel = `Agent: ${t}`;
            const nieuw = [...prev, regel];
            getSuggestions(nieuw.join("\n"));
            return nieuw;
          });
          setInterim("");
        } else if (!json.is_final) {
          setInterim(t ? `Agent: ${t}` : "");
        }
      }
    } catch {}
  }

  async function startPCM(ws: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 48000 },
    });
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
      let oi = 0,
        ii = 0;
      while (oi < newLen) {
        out[oi++] = buffer[Math.floor(ii)];
        ii += ratio;
      }
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
      try {
        proc.disconnect();
        source.disconnect();
      } catch {}
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        audioCtx.close();
      } catch {}
      cleanupPcmRef.current = null;
    };
  }

  /* ----------------------------- Controls ----------------------------- */

  const startRecording = async () => {
    setTranscript([]);
    setInterim("");
    setVisibleSuggestions([]);
    setSuggestionPool([]);
    setRecording(true);

    const { token } = await api.wsToken();

    const base = import.meta.env.VITE_API_BASE_URL as string;
    const wsBase = base.replace(/^http/i, "ws");

    const pcmUrl = `${wsBase}/ws/mic?conversation_id=${conversationId}&token=${encodeURIComponent(
      token
    )}&codec=linear16`;

    wsRef.current = new WebSocket(pcmUrl);

    wsRef.current.onopen = async () => {
      await startPCM(wsRef.current!);
    };

    wsRef.current.onmessage = async (event) => {
      const text = await normalizeWsText(event.data);
      if (!text) return;
      handleAsrJson(text);
    };
  };

  const stopRecording = () => {
    setRecording(false);
    try {
      cleanupPcmRef.current?.();
    } catch {}
    try {
      wsRef.current?.close();
    } catch {}

    // Prepare review
    const qs = transcript
      .map((l) => l.replace(/^Agent:\s*/, "").trim())
      .filter((l) => l.endsWith("?"));
    setAskedQuestions(qs);
    setShownSuggestions(visibleSuggestions);

    api
      .summarize({ transcript: transcript.join("\n") })
      .then((r: any) => setSummary(r?.summary ?? ""))
      .catch(() => setSummary("(Geen samenvatting)"));

    setReviewOpen(true);
  };

  /* ----------------------------- UI ----------------------------- */
  return (
    <main className="min-h-screen px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        {/* Transcriptie */}
        <section className="flex-1 rounded-3xl p-8 flex flex-col">
          <header className="mb-8">
            <h2 className="text-3xl font-black">Live Transcriptie</h2>
          </header>

          <div className="flex-1 flex flex-col rounded-xl min-h-[160px] p-2 md:p-6 gap-2">
            {transcript.length === 0 && (
              <div className="opacity-60 italic">Nog geen transcriptie...</div>
            )}
            {transcript.map((regel, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl p-4 bg-green-100">
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono">
                  {regel}
                </span>
              </div>
            ))}
            {interim && (
              <div className="flex items-start gap-3 rounded-2xl p-4 border-dashed border-2 opacity-70 border-green-400">
                <span className="px-3 py-1 rounded-xl text-xs font-bold">👨‍💼 Agent</span>
                <span className="whitespace-pre-line break-words text-base font-mono animate-pulse">
                  {interim}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 justify-center">
            <button
              className={`px-5 py-2 rounded-xl font-bold ${
                recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"
              }`}
              onClick={startRecording}
              disabled={recording}
            >
              ● Start
            </button>
            <button
              className={`px-5 py-2 rounded-xl font-bold ${
                !recording ? "opacity-60 cursor-not-allowed" : "bg-black text-white"
              }`}
              onClick={stopRecording}
              disabled={!recording}
            >
              ■ Stop
            </button>
          </div>
        </section>

        {/* Suggesties */}
        <aside className="w-full sm:w-80 rounded-3xl p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6">AI Vraagsuggesties</h3>
          <ul className="space-y-4 flex-1">
            {visibleSuggestions.length === 0 && (
              <li className="opacity-40">Nog geen suggesties...</li>
            )}
            {visibleSuggestions.map((s) => (
              <li key={s.id}>
                <SuggestionCard
                  suggestion={s}
                  onPinToggle={pinToggle}
                  onUsed={markUsed}
                  conversationId={conversationId}
                />
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        summary={summary}
        askedQuestions={askedQuestions}
        shownSuggestions={shownSuggestions}
        conversationId={conversationId}
      />
    </main>
  );
}
