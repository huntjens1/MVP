import { useState } from "react";
import { LayoutDashboard, Mic, History, Users, PlusCircle } from "lucide-react";
import CallLogixTranscriptie from "./CallLogixTranscriptie";
import TopBar from "./TopBar";
import { useAuth } from "../AuthContext";
import axios from "axios";

const TABS = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Nieuwe opname", icon: Mic },
  { name: "Opname geschiedenis", icon: History },
  { name: "Gebruikersbeheer", icon: Users },
];

const apiBase = import.meta.env.VITE_API_BASE || "";

export default function AdminDashboard() {
  const [tab, setTab] = useState("Dashboard");
  const { user } = useAuth();

  // States voor user invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteTenant, setInviteTenant] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [loading, setLoading] = useState(false);

  // Alleen superadmin mag gebruikersbeheer zien
  const isSuperAdmin = user?.role === "superadmin";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg("");
    setInviteError("");
    setLoading(true);
    try {
      const res = await axios.post(`${apiBase}/api/register`, {
        email: inviteEmail,
        password: Math.random().toString(36).slice(-10), // random wachtwoord
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

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900 relative">
      <TopBar />
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col py-8 px-4 shadow-lg">
        <div className="text-2xl font-black tracking-wide mb-8 flex items-center gap-3">
          <span className="bg-blue-700 p-2 rounded-xl"><LayoutDashboard size={32} /></span>
          CallLogix
        </div>
        <nav className="flex-1">
          {TABS.map(({ name, icon: Icon }) =>
            // Gebruikersbeheer alleen tonen als superadmin
            name !== "Gebruikersbeheer" || isSuperAdmin ? (
              <button
                key={name}
                onClick={() => setTab(name)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg my-1 transition ${
                  tab === name
                    ? "bg-blue-700 text-white font-bold shadow"
                    : "hover:bg-blue-800/70 text-blue-100"
                }`}
              >
                <Icon size={22} />
                {name}
              </button>
            ) : null
          )}
        </nav>
        <div className="mt-auto pt-10 text-xs text-blue-200/60">
          © {new Date().getFullYear()} CallLogix
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 bg-zinc-50 dark:bg-zinc-900 pt-24">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {tab}
          </h1>
        </header>

        {tab === "Dashboard" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><Mic size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Live Opnames</div>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><History size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Opname Geschiedenis</div>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><Users size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Gebruikers</div>
            </div>
          </div>
        )}

        {tab === "Nieuwe opname" && (
          <CallLogixTranscriptie />
        )}

        {tab === "Opname geschiedenis" && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow">
            <h2 className="text-lg font-bold mb-4">Eerdere opnames (hier kun je straks een lijst tonen uit je database/Supabase)</h2>
            <div className="text-zinc-500">(Nog geen data gekoppeld)</div>
          </div>
        )}

        {tab === "Gebruikersbeheer" && isSuperAdmin && (
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
        )}
      </main>
    </div>
  );
}
