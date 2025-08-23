import { useEffect, useState } from "react";
import api from "../api";

type Overview = {
  aht_seconds: number;
  suggestion_positive_pct: number;
};

export default function AdminDashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // voorbeeld extra actie (invite / settings) -> pas endpoint naar jouw backend aan indien nodig
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.analyticsOverview(); // nieuwe helper
        setOv(res);
      } catch (e: any) {
        setErr(e?.message || "Kon dashboard data niet laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      // voorbeeld PATCH (blijft werken via compat layer):
      await api.patch("/api/tenants/settings", { /* jouw payload */ });
      alert("Instellingen opgeslagen");
    } catch (e: any) {
      alert(e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Dashboard laden…</div>;
  if (err) return <div className="text-red-600">{err}</div>;
  if (!ov) return <div>Geen data</div>;

  const minutes = Math.floor((ov.aht_seconds || 0) / 60);
  const seconds = (ov.aht_seconds || 0) % 60;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin Dashboard</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Average Handle Time</div>
          <div className="text-xl font-bold">
            {minutes}m {seconds}s
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Suggestie-acceptatie</div>
          <div className="text-xl font-bold">{ov.suggestion_positive_pct}%</div>
        </div>
      </div>

      <div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className={`px-4 py-2 rounded ${saving ? "opacity-60" : "bg-black text-white"}`}
        >
          {saving ? "Opslaan…" : "Instellingen opslaan"}
        </button>
      </div>
    </div>
  );
}
