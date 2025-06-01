import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function ConversationDetail() {
  const { id } = useParams();
  type TranscriptBlock = {
  id: string;
  speaker_label: string;
  start_time: number;
  content: string;
};

const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);

  useEffect(() => {
    async function fetchTranscripts() {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE}/api/conversations/${id}/transcripts`);
      setTranscripts(res.data);
    }
    fetchTranscripts();
  }, [id]);

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Transcriptie-fragmenten</h1>
      <ul>
        {transcripts.map(block => (
          <li key={block.id} className="mb-2">
            <span className="font-bold">{block.speaker_label}</span>{" "}
            <span className="text-gray-500">({block.start_time.toFixed(1)}s):</span>{" "}
            {block.content}
          </li>
        ))}
      </ul>
    </main>
  );
}
