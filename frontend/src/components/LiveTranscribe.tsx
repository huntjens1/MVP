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
    <div>
      <h2>Live Transcriptie</h2>
      <button onClick={startRecording} disabled={recording}>Start opname</button>
      <button onClick={stopRecording} disabled={!recording}>Stop opname</button>
      <div style={{marginTop: 16, background: "#222", color: "#0ff", padding: 12, borderRadius: 8}}>
        <strong>Live transcriptie:</strong>
        <div style={{marginTop: 8}}>{transcript} <span style={{opacity: 0.7}}>{interim}</span></div>
      </div>
    </div>
  );
}
