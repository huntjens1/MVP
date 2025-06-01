import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

type TranscriptBlock = {
  id: string;
  speaker_label: string;
  start_time: number;
  content: string;
};

export default function ConversationDetail() {
  const { id } = useParams();
  const [conversation, setConversation] = useState<any>(null);
  const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);

  useEffect(() => {
    async function fetchData() {
      // Haal conversatie op (optioneel, alleen voor header-info)
      const convRes = await axios.get(`${import.meta.env.VITE_API_BASE}/api/conversations/${id}`);
      setConversation(convRes.data);
      // Haal transcript-blokken op
      const transRes = await axios.get(`${import.meta.env.VITE_API_BASE}/api/conversations/${id}/transcripts`);
      setTranscripts(transRes.data);
    }
    fetchData();
  }, [id]);

  if (!conversation) return <div>Bezig met laden...</div>;

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Gespreksdetails</h1>
      <div className="mb-4 p-4 rounded bg-calllogix-card">
        <strong>Datum:</strong> {new Date(conversation.started_at).toLocaleString()}<br />
        <strong>Duur:</strong> {conversation.duration_seconds || 0} seconden<br />
        <strong>Agent:</strong> {conversation.agent_id}<br />
        <strong>Klant:</strong> {conversation.customer_id}<br />
        <strong>ITIL categorie:</strong> {conversation.itil_category}<br />
        <strong>Prioriteit:</strong> {conversation.priority}<br />
        <strong>Impact:</strong> {conversation.impact}<br />
        <strong>Tags:</strong> {(conversation.tags || []).join(", ")}
      </div>
      <div className="mb-4 p-4 rounded bg-calllogix-card">
        <h2 className="text-xl font-semibold mb-2">Transcriptie</h2>
        <ul>
          {transcripts.map(block => (
            <li key={block.id} className="mb-2">
              <span className="font-bold">{block.speaker_label}</span>{" "}
              <span className="text-gray-500">({block.start_time.toFixed(1)}s):</span>{" "}
              {block.content}
            </li>
          ))}
        </ul>
      </div>
      {conversation.audio_url && (
        <audio controls src={conversation.audio_url} className="mt-4 w-full" />
      )}
    </main>
  );
}
