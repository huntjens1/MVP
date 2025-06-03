import { useRef, useState } from "react";
import api from "../api"; // pad kan verschillen!
import { useAuth } from "../AuthContext";

// 👇 SuggestionFeedback-component stuurt nu ook de tekst mee
function SuggestionFeedback({
  suggestion,
  conversationId,
  userId,
}: {
  suggestion: { id: string; text: string };
  conversationId: string;
  userId: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function sendFeedback(rating: "good" | "bad") {
    setFeedback(rating);
    try {
      await api.post("/api/ai-feedback", {
        suggestion_id: suggestion.id,
        suggestion_text: suggestion.text,
        conversation_id: conversationId,
        user_id: userId,
        feedback: rating,
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
        onClick={() => sendFeedback("good")}
        disabled={!!feedback}
      >
        👍 Goed
      </button>
      <button
        className={`px-2 py-1 rounded-lg ${feedback === "bad" ? "bg-red-600 text-white" : "bg-gray-200"}`}
        onClick={() => sendFeedback("bad")}
        disabled={!!feedback}
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
  const [suggestions, setSuggestions] = useState<{ id: string; text: string }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSuggestionSentRef = useRef("");
  const [conversationId] = useState(() => crypto.randomUUID());
  const { user } = useAuth();
  const userId = user?.id;

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
      const resp = await api.post("/api/suggest-question", {
        transcript: currentTranscript,
      });
      const data = resp.data;
      if (data.suggestions) setSuggestions(data.suggestions); // [{id, text}]
    } catch {}
  }

  const startRecording = async () => {
    setTranscript([]);
    setInterim("");
    setSuggestions([]);
    setRecording(true);

    // Deepgram-token ophalen (voor WebSocket authenticatie)
    const tokenResp = await api.post("/api/deepgram-token", {});
    const token = tokenResp.data.token;
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
          const tekst = json.channel.alternatives[0].transcript?.trim();
          if (json.is_final && tekst) {
            setTranscript((prev) => {
              const regel = `${label}: ${tekst}|||${speaker}`;
              const nieuw = [...prev, regel];
              getSuggestions(
                nieuw
                  .map((r) => r.split("|||")[0])
                  .join("\n")
              );
              return nieuw;
            });
            setInterim("");
          } else if (!json.is_final) {
            setInterim(tekst ? `${label}: ${tekst}|||${speaker}` : "");
          }
        }
      } catch (e) {}
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

  function parseLine(line: string) {
    if (!line) return { label: "", text: "", speaker: 0 };
    const [prefix, speakerStr] = line.split("|||");
    const splitIdx = prefix.indexOf(": ");
    const label = splitIdx >= 0 ? prefix.slice(0, splitIdx) : "Onbekend";
    const text = splitIdx >= 0 ? prefix.slice(splitIdx + 2) : prefix;
    const speaker = Number(speakerStr ?? 0);
    return { label, text, speaker };
  }

  return (
    <main className="min-h-screen bg-calllogix-dark px-2 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-8 items-stretch">
        {/* Transcriptie panel */}
        <section className="flex-1 bg-calllogix-card rounded-3xl shadow-2xl p-8 border border-calllogix-primary/30 flex flex-col">
          <header className="mb-8">
            <h2 className="text-3xl font-black text-calllogix-primary drop-shadow">
              Live Transcriptie
            </h2>
          </header>
          <div className="flex-1 flex flex-col rounded-xl bg-calllogix-dark min-h-[160px] p-2 md:p-6 shadow-inner gap-2">
            {transcript.length === 0 && (
              <div className="opacity-60 italic">
                Nog geen transcriptie...
              </div>
            )}
            {transcript.map((regel, i) => {
              const { label, text, speaker } = parseLine(regel);
              if (!text) return null;
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
              if (!text) return null;
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
          <div className="flex gap-3 mt-6 justify-center">
            <button
              className={`px-5 py-2 rounded-xl font-bold transition shadow ${
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
          <div className="text-right text-xs text-calllogix-subtext mt-2">
            {recording ? "Opname loopt..." : "Klik op Start om te beginnen"}
          </div>
        </section>
        <aside className="w-full sm:w-80 bg-calllogix-card rounded-3xl p-8 border border-calllogix-accent/40 shadow-2xl flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-calllogix-accent drop-shadow">
            AI Vraagsuggesties
          </h3>
          <ul className="space-y-4 flex-1">
            {suggestions.length === 0 && (
              <li className="opacity-40">Nog geen suggesties...</li>
            )}
            {!userId ? (
              <li className="text-red-500">Log eerst in om feedback te geven.</li>
            ) : (
              suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="bg-calllogix-dark text-calllogix-accent rounded-2xl p-4 border border-calllogix-primary/30 shadow"
                >
                  <SuggestionFeedback
                    suggestion={suggestion}
                    conversationId={conversationId}
                    userId={userId}
                  />
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
      <footer className="mt-10 text-center text-calllogix-subtext text-sm">
        <span className="font-semibold text-calllogix-accent">CallLogix</span>{" "}
        — Powered by Deepgram, OpenAI & Supabase — v1.0 MVP
      </footer>
    </main>
  );
}
