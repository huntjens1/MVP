import { useState, useEffect } from "react";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import api from "../api";

const res = await api.get("/api/tenants");

export default function AdminDashboard() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("support"); // default geldige rol!
  const [inviteTenant, setInviteTenant] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState<{ id: string, name: string }[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  // Haal tenants op
  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await api.get("/api/tenants");
        setTenants(res.data.tenants);
      } catch {
        setTenants([]);
      } finally {
        setTenantsLoading(false);
      }
    }
    fetchTenants();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg("");
    setInviteError("");
    setLoading(true);
    try {
      await api.post("/api/invite-user", {
        email: inviteEmail,
        password: Math.random().toString(36).slice(-10),
        tenant_id: inviteTenant,
        role: inviteRole,
      });
      setInviteMsg(`Gebruiker uitgenodigd (${inviteEmail})`);
      setInviteEmail("");
      setInviteRole("support");
      setInviteTenant("");
    } catch (err: any) {
      setInviteError(
        err.response?.data?.error || err.message || "Toevoegen mislukt"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        Alleen voor superadmin toegankelijk.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow max-w-lg">
      <h2 className="text-xl font-bold mb-6 flex gap-3 items-center">
        <PlusCircle className="text-blue-700" /> Nieuwe gebruiker uitnodigen
      </h2>
      <form className="flex flex-col gap-4" onSubmit={handleInvite}>
        <input
          type="email"
          required
          placeholder="E-mailadres"
          className="px-4 py-2 rounded-xl border border-blue-300 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
        />
        <select
          className="px-4 py-2 rounded-xl border border-blue-300 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          required
          value={inviteTenant}
          onChange={e => setInviteTenant(e.target.value)}
          disabled={tenantsLoading}
        >
          <option value="">Kies een tenant...</option>
          {tenants.map(tenant => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.id.slice(0, 8)}…)
            </option>
          ))}
        </select>
        <select
          className="px-4 py-2 rounded-xl border border-blue-300 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value)}
        >
          <option value="support">Support</option>
          <option value="coordinator">Coordinator</option>
          <option value="manager">Manager</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <button
          type="submit"
          className="bg-blue-700 text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-900 transition disabled:bg-blue-300"
          disabled={loading}
        >
          {loading ? "Toevoegen..." : "Gebruiker toevoegen"}
        </button>
        {inviteMsg && <div className="text-green-600 font-bold">{inviteMsg}</div>}
        {inviteError && <div className="text-red-500 font-bold">{inviteError}</div>}
      </form>
    </div>
  );
}
