import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE || "";

export default function AdminDashboard() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteTenant, setInviteTenant] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg("");
    setInviteError("");
    setLoading(true);
    try {
      await axios.post(`${apiBase}/api/invite-user`, {
        email: inviteEmail,
        password: Math.random().toString(36).slice(-10),
        tenant_id: inviteTenant,
        role: inviteRole,
      });
      setInviteMsg(`Gebruiker uitgenodigd (${inviteEmail})`);
      setInviteEmail("");
      setInviteRole("user");
      setInviteTenant("");
    } catch (err: any) {
      setInviteError(err.response?.data?.error || "Fout bij uitnodigen gebruiker.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) {
    return <div className="p-10 text-center text-red-500 font-bold">Alleen voor superadmin toegankelijk.</div>;
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
        <input
          type="text"
          required
          placeholder="Tenant ID"
          className="px-4 py-2 rounded-xl border border-blue-300 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          value={inviteTenant}
          onChange={e => setInviteTenant(e.target.value)}
        />
        <select
          className="px-4 py-2 rounded-xl border border-blue-300 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value)}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
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
