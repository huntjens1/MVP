import { useEffect, useState } from "react";
import api from "../api";
import { useParams } from "react-router-dom";

type Conversation = {
  id: string;
  started_at?: string;
  ended_at?: string | null;
  status?: string;
  duration_seconds?: number | null;
};

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Gebruik jouw bestaande endpoint; compat .get blijft werken:
        const res = await api.get(`/api/conversations/${id}`);
        setConv(res?.conversation || res);
      } catch (e: any) {
        setErr(e?.message || "Kon conversatie niet laden");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const closeConversation = async () => {
    if (!id) return;
    setClosing(true);
    try {
      const res = await api.post(`/api/conversations/${id}/close`);
      setConv(res?.conversation || res);
      alert("Conversatie gesloten");
    } catch (e: any) {
      alert(e?.message || "Sluiten mislukt");
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <div>Conversatie laden…</div>;
  if (err) return <div className="text-red-600">{err}</div>;
  if (!conv) return <div>Niet gevonden</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Conversatie</h2>
      <div className="rounded border p-4 space-y-2">
        <div><b>ID:</b> {conv.id}</div>
        <div><b>Status:</b> {conv.status}</div>
        <div><b>Gestart:</b> {conv.started_at}</div>
        <div><b>Geëindigd:</b> {conv.ended_at || "-"}</div>
        <div><b>Duur:</b> {conv.duration_seconds ?? 0}s</div>
      </div>

      <button
        onClick={closeConversation}
        disabled={closing}
        className={`px-4 py-2 rounded ${closing ? "opacity-60" : "bg-black text-white"}`}
      >
        {closing ? "Sluiten…" : "Sluit conversatie"}
      </button>
    </div>
  );
}
