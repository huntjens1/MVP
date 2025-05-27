import { useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || '';

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSuggestionSentRef = useRef(""); // voorkomt dubbele suggesties

  // Mapping: speaker 0 = Agent, speaker 1 = Gebruiker
  function speakerLabel(speaker: number) {
    return speaker === 0 ? "Agent" : "Gebruiker";
  }

  async function getSuggestions(currentTranscript: string) {
    if (!currentTranscript.trim() || currentTranscript.trim() === lastSuggestionSentRef.current) return;
    lastSuggestionSentRef.current = currentTranscript.trim();

    try {
      const resp = await fetch(`${apiBase}/api/suggest-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: currentTranscript }),
      });
      const data = await resp.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {
      // optioneel: foutmelding
    }
  }

  const startRecording = async () => {
    setTranscript([]);
    setInterim("");
    setSuggestions([]);
    setRecording(true);

    const tokenResp = await fetch(`${apiBase}/api/deepgram-token`, { method: "POST" });
    const tokenJson = await tokenResp.json();
    const token = tokenJson.token;

    // Diarization aan
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=nl&sample_rate=16000&interim_results=true&punctuate=true&diarize=true`;

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
          const words = json.channel?.alternatives?.[0]?.words || [];
          const speaker = words.length > 0 && words[0].speaker !== undefined ? words[0].speaker : 0;
          const label = speakerLabel(speaker);

          if (json.is_final) {
            setTranscript(prev => {
              const regel = `${label}: ${json.channel.alternatives[0].transcript}`;
              const nieuw = [...prev, regel];
              getSuggestions(nieuw.join('\n'));
              return nieuw;
            });
            setInterim("");
          } else {
            setInterim(`${label}: ${json.channel.alternatives[0].transcript}`);
          }
        }
      } catch (e) {
        // geen geldige JSON of structure, negeren
      }
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
    <main className="min-h-screen bg-calllogix-dark px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        {/* Transcriptie panel */}
        <section className="flex-1 bg-calllogix-card rounded-3xl shadow-2xl p-8 border border-calllogix-primary/30 flex flex-col">
          <header className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-calllogix-primary drop-shadow">Live Transcriptie</h2>
            <div className="flex gap-2">
              <button
                className={`px-5 py-2 rounded-xl font-bold mr-2 transition shadow ${
                  recording
                    ? "bg-calllogix-primary/40 text-calllogix-text cursor-not-allowed"
                    : "bg-calllogix-accent text-calllogix-dark hover:bg-calllogix-primary hover:text-calllogix-text"
                }`}
                onClick={startRecording}
                disabled={recording}
              >
                <span className="font-black text-lg">●</span> Start
              </button>
              <button
                className={`px-5 py-2 rounded-xl font-bold transition shadow ${
                  !recording
                    ? "bg-calllogix-primary/40 text-calllogix-text cursor-not-allowed"
                    : "bg-calllogix-primary text-calllogix-text hover:bg-calllogix-accent hover:text-calllogix-dark"
                }`}
                onClick={stopRecording}
                disabled={!recording}
              >
                ■ Stop
              </button>
            </div>
          </header>
          <div className="flex-1 flex flex-col">
            <div className="rounded-xl bg-calllogix-dark min-h-[160px] p-6 text-xl leading-relaxed text-calllogix-text tracking-wide shadow-inner font-mono select-text whitespace-pre-line">
              {transcript.map((regel, i) => (
                <div key={i}>{regel}</div>
              ))}
              <span className="animate-pulse opacity-70 ml-2">{interim}</span>
            </div>
            <div className="text-right text-xs text-calllogix-subtext mt-2">
              {recording ? 'Opname loopt...' : 'Klik op Start om te beginnen'}
            </div>
          </div>
        </section>
        {/* Suggesties panel */}
        <aside className="w-full sm:w-80 bg-calllogix-card rounded-3xl p-8 border border-calllogix-accent/40 shadow-2xl flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-calllogix-accent drop-shadow">AI Vraagsuggesties</h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && <li className="opacity-40">Nog geen suggesties...</li>}
            {suggestions.map((s, i) => (
              <li key={i} className="bg-calllogix-dark text-calllogix-accent rounded-2xl p-4 border border-calllogix-primary/30 shadow">
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      {/* Footer */}
      <footer className="mt-10 text-center text-calllogix-subtext text-sm">
        <span className="font-semibold text-calllogix-accent">CallLogix</span> — Powered by Deepgram, OpenAI & Supabase — v1.0 MVP
      </footer>
    </main>
  );
}
