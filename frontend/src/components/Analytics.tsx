import { useEffect, useState } from "react";
import api from "../api";

type Overview = {
  aht_seconds: number;
  suggestion_positive_pct: number;
};

export default function Analytics() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.analyticsOverview(); // nieuwe helper
        setData(res);
      } catch (e: any) {
        setError(e?.message || "Kon analytics niet laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Analytics laden…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Geen data</div>;

  const minutes = Math.floor((data.aht_seconds || 0) / 60);
  const seconds = (data.aht_seconds || 0) % 60;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Analytics</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Average Handle Time</div>
          <div className="text-xl font-bold">
            {minutes}m {seconds}s
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">AI Suggestie-acceptatie</div>
          <div className="text-xl font-bold">{data.suggestion_positive_pct}%</div>
        </div>
      </div>
    </div>
  );
}
