import { useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || '';

export default function LiveTranscribe() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startRecording = async () => {
    setTranscript("");
    setInterim("");
    setRecording(true);

    // Vraag Deepgram token op bij backend
    const tokenResp = await fetch(`${apiBase}/api/deepgram-token`, { method: "POST" });
    const tokenJson = await tokenResp.json();
    const token = tokenJson.token;

    // Zet WS URL (model, taal en sample_rate kunnen eventueel aangepast)
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=nl&sample_rate=16000&interim_results=true&punctuate=true`;

    // Open WebSocket naar Deepgram met het ontvangen token (bearer flow)
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
            setTranscript((prev) => prev + " " + json.channel.alternatives[0].transcript);
            setInterim("");
          } else {
            setInterim(json.channel.alternatives[0].transcript);
          }
        }
      } catch (e) {
        // Non-JSON message of error, negeren voor nu
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
    <div className="bg-calllogix-card rounded-2xl shadow-xl p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-black text-calllogix-primary mb-6">Live Transcriptie</h2>
      <div className="flex gap-4 mb-6">
        <button
          className={`px-6 py-2 rounded-xl font-bold transition shadow ${
            recording
              ? "bg-calllogix-primary/40 text-calllogix-text cursor-not-allowed"
              : "bg-calllogix-accent text-calllogix-dark hover:bg-calllogix-primary hover:text-calllogix-text"
          }`}
          onClick={startRecording}
          disabled={recording}
        >
          ● Start opname
        </button>
        <button
          className={`px-6 py-2 rounded-xl font-bold transition shadow ${
            !recording
              ? "bg-calllogix-primary/40 text-calllogix-text cursor-not-allowed"
              : "bg-calllogix-primary text-calllogix-text hover:bg-calllogix-accent hover:text-calllogix-dark"
          }`}
          onClick={stopRecording}
          disabled={!recording}
        >
          ■ Stop opname
        </button>
      </div>
      <div className="bg-calllogix-dark rounded-xl p-6 min-h-[120px] text-lg font-mono text-calllogix-text shadow-inner select-text">
        <span className="opacity-95">{transcript}</span>
        <span className="animate-pulse opacity-70 ml-2">{interim}</span>
      </div>
      <div className="text-right text-calllogix-subtext mt-2 text-xs">
        {recording ? "Opname loopt..." : "Klik op Start om te beginnen"}
      </div>
    </div>
  );
}
