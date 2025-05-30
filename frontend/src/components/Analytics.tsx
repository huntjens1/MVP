import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../AuthContext";
import { Navigate } from "react-router-dom";

export default function Analytics() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<
    { suggestion_id: string; suggestion_text: string; thumbs_up: number; thumbs_down: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  if (!user || !["superadmin", "manager"].includes(user.role)) {
    return <Navigate to="/app" />;
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE}/api/analytics/ai-feedback-summary`
        );
        setSummary(res.data.summary || []);
      } catch {
        setSummary([]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-calllogix-accent">AI Suggestie Feedback Analytics</h1>
      {loading ? (
        <div>Bezig met laden...</div>
      ) : summary.length === 0 ? (
        <div>Geen feedback gevonden.</div>
      ) : (
        <table className="w-full text-left border mt-4">
          <thead>
            <tr>
              <th className="border-b px-4 py-2">Suggestie</th>
              <th className="border-b px-4 py-2">👍</th>
              <th className="border-b px-4 py-2">👎</th>
            </tr>
          </thead>
          <tbody>
            {summary
              .sort((a, b) => b.thumbs_up - a.thumbs_up)
              .map((row) => (
                <tr key={row.suggestion_id}>
                  <td className="border-b px-4 py-2">{row.suggestion_text}</td>
                  <td className="border-b px-4 py-2">{row.thumbs_up}</td>
                  <td className="border-b px-4 py-2">{row.thumbs_down}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
