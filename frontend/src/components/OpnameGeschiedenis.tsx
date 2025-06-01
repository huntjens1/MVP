import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

type Conversation = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  agent_id: string | null;
  customer_id: string | null;
  itil_category: string | null;
  priority: string | null;
  impact: string | null;
  tags: string[] | null;
};

export default function OpnameGeschiedenis() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE}/api/conversations`
        );
        setConversations(res.data || []);
      } catch (e) {
        setConversations([]);
      }
      setLoading(false);
    }
    fetchConversations();
  }, []);

  return (
    <section>
      <h2 className="text-3xl font-black text-calllogix-primary mb-6">
        Opname Geschiedenis
      </h2>
      <div className="bg-calllogix-card rounded-2xl p-8 shadow-xl text-calllogix-text">
        {loading ? (
          <div className="text-calllogix-accent">Laden...</div>
        ) : conversations.length === 0 ? (
          <p>Nog geen opnames...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Datum</th>
                  <th className="px-4 py-2 text-left">Duur</th>
                  <th className="px-4 py-2 text-left">Agent</th>
                  <th className="px-4 py-2 text-left">Klant</th>
                  <th className="px-4 py-2 text-left">ITIL categorie</th>
                  <th className="px-4 py-2 text-left">Prioriteit</th>
                  <th className="px-4 py-2 text-left">Tags</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => (
                  <tr
                    key={conv.id}
                    className="border-b hover:bg-calllogix-primary/10 transition"
                  >
                    <td className="px-4 py-2 font-mono">
                      {conv.started_at
                        ? new Date(conv.started_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {conv.duration_seconds
                        ? `${Math.floor(conv.duration_seconds / 60)}m ${conv.duration_seconds % 60}s`
                        : "-"}
                    </td>
                    <td className="px-4 py-2">{conv.agent_id || "-"}</td>
                    <td className="px-4 py-2">{conv.customer_id || "-"}</td>
                    <td className="px-4 py-2">
                      {conv.itil_category || "-"}
                    </td>
                    <td className="px-4 py-2">{conv.priority || "-"}</td>
                    <td className="px-4 py-2">
                      {(conv.tags && conv.tags.length > 0)
                        ? conv.tags.join(", ")
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/app/conversations/${conv.id}`}
                        className="text-calllogix-accent hover:underline font-semibold"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
