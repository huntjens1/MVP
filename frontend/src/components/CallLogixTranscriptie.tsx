import { useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || '';

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSuggestionSentRef = useRef(""); // voorkomt dubbele suggesties

  // Vraag OpenAI suggesties aan (zoals eerder)
  async function getSuggestions(transcript: string) {
    if (!transcript.trim() || transcript.trim() === lastSuggestionSentRef.current) return;
    lastSuggestionSentRef.current = transcript.trim();

    const resp = await fetch(`${apiBase}/api/suggest-question`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ transcript }),
    });
    const data = await resp.json();
    if (data.suggestions) setSuggestions(data.suggestions);
  }

  const startRecording = async () => {
    setTranscript("");
    setInterim("");
    setSuggestions([]);
    setRecording(true);

    const tokenResp = await fetch(`${apiBase}/api/deepgram-token`, { method: "POST" });
    const tokenJson = await tokenResp.json();
    const token = tokenJson.token;
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=nl&sample_rate=16000&interim_results=true&punctuate=true`;

    wsRef.current = new WebSocket(wsUrl, ["bearer", token]);
    wsRef.current.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && wsRef.current?.readyState === 1) {
            const buf = await e.data.arrayBuffer();
            wsRef.current.send(buf);
          }
        };
        mediaRecorder.start(250);
        wsRef.current!.onclose = () => {
          stream.getTracks().forEach(track => track.stop());
        };
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        if (json.channel?.alternatives?.[0]?.transcript !== undefined) {
          if (json.is_final) {
            setTranscript((prev) => {
              const nieuw = (prev + " " + json.channel.alternatives[0].transcript).trim();
              getSuggestions(nieuw); // vraag suggesties bij elk nieuw stuk tekst
              return nieuw;
            });
            setInterim("");
          } else {
            setInterim(json.channel.alternatives[0].transcript);
          }
        }
      } catch (e) { /* negeren */ }
    };
  };

  const stopRecording = () => {
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    wsRef.current?.close();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-cyan-950 px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        {/* Transcriptie panel */}
        <section className="flex-1 bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-800 flex flex-col">
          <header className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-cyan-400 drop-shadow">Live Transcriptie</h2>
            <div className="flex gap-2">
              <button
                className={`px-5 py-2 rounded-xl font-semibold mr-2 transition ${
                  recording ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                }`}
                onClick={startRecording}
                disabled={recording}
              >
                <span className="font-black text-lg">●</span> Start
              </button>
              <button
                className={`px-5 py-2 rounded-xl font-semibold transition ${
                  !recording ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                onClick={stopRecording}
                disabled={!recording}
              >
                ■ Stop
              </button>
            </div>
          </header>
          <div className="flex-1 flex flex-col">
            <div className="rounded-xl bg-zinc-800 min-h-[160px] p-6 text-xl leading-relaxed text-cyan-100 tracking-wide shadow-inner font-mono select-text">
              <span className="opacity-90">{transcript}</span>
              <span className="animate-pulse opacity-60 ml-2">{interim}</span>
            </div>
            <div className="text-right text-xs text-zinc-500 mt-2">
              {recording ? 'Opname loopt...' : 'Klik op Start om te beginnen'}
            </div>
          </div>
        </section>
        {/* Suggesties panel */}
        <aside className="w-full sm:w-80 bg-zinc-950 rounded-3xl p-8 border border-cyan-700/40 shadow-2xl flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-cyan-300 drop-shadow">AI Vraagsuggesties</h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && <li className="opacity-40">Nog geen suggesties...</li>}
            {suggestions.map((s, i) => (
              <li key={i} className="bg-zinc-800 text-cyan-100 rounded-2xl p-4 border border-cyan-900 shadow">
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      {/* Footer */}
      <footer className="mt-10 text-center text-zinc-600 text-sm">
        <span className="font-semibold text-cyan-300">CallLogix</span> — Powered by Deepgram, OpenAI & Supabase — v1.0 MVP
      </footer>
    </main>
  );
}
