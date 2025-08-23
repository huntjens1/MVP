import { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";

type ConversationRow = {
  id: string;
  started_at?: string;
  ended_at?: string | null;
  status?: string;
  duration_seconds?: number | null;
};

export default function OpnameGeschiedenis() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Gebruik jouw bestaande endpoint (bijv. /api/conversations?limit=50)
        const res = await api.get(`/api/conversations?limit=50`);
        setRows(res?.items || res?.conversations || res || []);
      } catch (e: any) {
        setErr(e?.message || "Kon opnames niet laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Geschiedenis laden…</div>;
  if (err) return <div className="text-red-600">{err}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Opname geschiedenis</h2>
      <div className="rounded border divide-y">
        {rows.length === 0 && <div className="p-4 opacity-70">Geen gesprekken gevonden</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm opacity-70">{r.status || "-"}</div>
              <div className="text-xs opacity-60">
                {r.started_at} → {r.ended_at || "-"} ({r.duration_seconds ?? 0}s)
              </div>
            </div>
            <Link
              to={`/conversations/${r.id}`}
              className="px-3 py-1 rounded bg-black text-white text-sm"
            >
              Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
