import { useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "";

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSuggestionSentRef = useRef("");

  // Mapping: speaker 0 = Agent, speaker 1 = Gebruiker
  function speakerLabel(speaker: number) {
    return speaker === 0 ? "Agent" : "Gebruiker";
  }
  function speakerIcon(speaker: number) {
    return speaker === 0 ? "👨‍💼" : "👤";
  }

  async function getSuggestions(currentTranscript: string) {
    if (
      !currentTranscript.trim() ||
      currentTranscript.trim() === lastSuggestionSentRef.current
    )
      return;
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

    const tokenResp = await fetch(`${apiBase}/api/deepgram-token`, {
      method: "POST",
    });
    const tokenJson = await tokenResp.json();
    const token = tokenJson.token;

    // Diarization aan
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=nl&sample_rate=16000&interim_results=true&punctuate=true&diarize=true`;

    wsRef.current = new WebSocket(wsUrl, ["bearer", token]);
    wsRef.current.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && wsRef.current?.readyState === 1) {
            const buf = await e.data.arrayBuffer();
            wsRef.current.send(buf);
          }
        };
        mediaRecorder.start(250);
        wsRef.current!.onclose = () => {
          stream.getTracks().forEach((track) => track.stop());
        };
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        if (json.channel?.alternatives?.[0]?.transcript !== undefined) {
          const words = json.channel?.alternatives?.[0]?.words || [];
          const speaker =
            words.length > 0 && words[0].speaker !== undefined
              ? words[0].speaker
              : 0;
          const label = speakerLabel(speaker);

          if (json.is_final) {
            setTranscript((prev) => {
              const regel = `${label}: ${json.channel.alternatives[0].transcript}|||${speaker}`;
              const nieuw = [...prev, regel];
              getSuggestions(
                nieuw
                  .map((r) => r.split("|||")[0])
                  .join("\n")
              );
              return nieuw;
            });
            setInterim("");
          } else {
            setInterim(
              `${label}: ${json.channel.alternatives[0].transcript}|||${speaker}`
            );
          }
        }
      } catch (e) {
        // geen geldige JSON of structure, negeren
      }
    };
  };

  const stopRecording = () => {
    setRecording(false);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    wsRef.current?.close();
  };

  // Helper om label en speaker te splitsen (voor styling)
  function parseLine(line: string) {
    if (!line) return { label: "", text: "", speaker: 0 };
    const [prefix, speakerStr] = line.split("|||");
    const splitIdx = prefix.indexOf(": ");
    const label = splitIdx >= 0 ? prefix.slice(0, splitIdx) : "Onbekend";
    const text = splitIdx >= 0 ? prefix.slice(splitIdx + 2) : prefix;
    const speaker = Number(speakerStr ?? 0);
    return { label, text, speaker };
  }

  // Transcriptie UI chatstijl
  return (
    <main className="min-h-screen bg-calllogix-dark px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        {/* Transcriptie panel */}
        <section className="flex-1 bg-calllogix-card rounded-3xl shadow-2xl p-8 border border-calllogix-primary/30 flex flex-col">
          <header className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-calllogix-primary drop-shadow">
              Live Transcriptie
            </h2>
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
          <div className="flex-1 flex flex-col rounded-xl bg-calllogix-dark min-h-[160px] p-2 md:p-6 shadow-inner gap-2">
            {transcript.length === 0 && (
              <div className="opacity-60 italic">
                Nog geen transcriptie...
              </div>
            )}
            {transcript.map((regel, i) => {
              const { label, text, speaker } = parseLine(regel);
              const isAgent = label === "Agent";
              const roleClass = isAgent
                ? "bg-calllogix-primary/90 text-calllogix-text"
                : "bg-calllogix-accent/90 text-calllogix-dark";
              const badgeClass = isAgent
                ? "bg-calllogix-primary text-calllogix-text"
                : "bg-calllogix-accent text-calllogix-dark";
              const icon = speakerIcon(speaker);
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-2xl p-4 shadow-inner ${roleClass}`}
                  style={{
                    maxWidth: "90%",
                    alignSelf: isAgent ? "flex-start" : "flex-end",
                  }}
                >
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold shadow flex items-center gap-1 ${badgeClass}`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </span>
                  <span className="whitespace-pre-line break-words text-base font-mono">
                    {text}
                  </span>
                </div>
              );
            })}
            {interim && (() => {
              const { label, text, speaker } = parseLine(interim);
              const isAgent = label === "Agent";
              const badgeClass = isAgent
                ? "bg-calllogix-primary text-calllogix-text"
                : "bg-calllogix-accent text-calllogix-dark";
              const icon = speakerIcon(speaker);
              return (
                <div
                  className={`flex items-start gap-3 rounded-2xl p-4 border-dashed border-2 border-calllogix-accent/60 opacity-70`}
                  style={{
                    maxWidth: "90%",
                    alignSelf: isAgent ? "flex-start" : "flex-end",
                  }}
                >
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold shadow flex items-center gap-1 ${badgeClass}`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </span>
                  <span className="whitespace-pre-line break-words text-base font-mono animate-pulse">
                    {text}
                  </span>
                </div>
              );
            })()}
          </div>
          <div className="text-right text-xs text-calllogix-subtext mt-2">
            {recording ? "Opname loopt..." : "Klik op Start om te beginnen"}
          </div>
        </section>
        {/* Suggesties panel */}
        <aside className="w-full sm:w-80 bg-calllogix-card rounded-3xl p-8 border border-calllogix-accent/40 shadow-2xl flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-calllogix-accent drop-shadow">
            AI Vraagsuggesties
          </h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && (
              <li className="opacity-40">Nog geen suggesties...</li>
            )}
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="bg-calllogix-dark text-calllogix-accent rounded-2xl p-4 border border-calllogix-primary/30 shadow"
              >
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      {/* Footer */}
      <footer className="mt-10 text-center text-calllogix-subtext text-sm">
        <span className="font-semibold text-calllogix-accent">CallLogix</span>{" "}
        — Powered by Deepgram, OpenAI & Supabase — v1.0 MVP
      </footer>
    </main>
  );
}
