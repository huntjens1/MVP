import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";

type Tenant = { id: string; name: string; domain: string; };
type User = { id: string; email: string; role: string; tenant_id: string; };

const ROLES = ["support", "coordinator", "manager", "superadmin"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newTenant, setNewTenant] = useState({ name: "", domain: "" });
  const [newUser, setNewUser] = useState({ email: "", role: "support", tenant_id: "" });
  const [refresh, setRefresh] = useState(0);

  // Alleen superadmin mag deze UI zien!
  if (!user || user.role !== "superadmin") return null;

  useEffect(() => {
    supabase.from("tenants").select("id, name, domain").then(({ data }) => setTenants(data || []));
    supabase.from("users").select("id, email, role, tenant_id").then(({ data }) => setUsers(data || []));
  }, [refresh]);

  // User invite: verstuur invite via Supabase backend (mail), voeg in users-tabel toe met rol/tenant
  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault();
    // Invite via Supabase Auth (let op: user moet via e-mail activeren)
    const { error } = await supabase.auth.admin.inviteUserByEmail(newUser.email);
    if (!error) {
      // Voeg direct user-row toe voor deze gebruiker
      await supabase.from("users").insert({
        id: crypto.randomUUID(), // LET OP: update met juiste id na activatie!
        email: newUser.email,
        role: newUser.role,
        tenant_id: newUser.tenant_id,
      });
      setNewUser({ email: "", role: "support", tenant_id: "" });
      setRefresh(x => x + 1);
      alert("Invite sent and user added! User must activate via email.");
    } else {
      alert(error.message);
    }
  }

  // Superadmin kan direct user-row toevoegen (bypasst invite flow)
  async function handleCreateUserDirect(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("users").insert({
      id: crypto.randomUUID(), // of laat leeg voor auto-gen
      email: newUser.email,
      role: newUser.role,
      tenant_id: newUser.tenant_id,
    });
    setNewUser({ email: "", role: "support", tenant_id: "" });
    setRefresh(x => x + 1);
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("tenants").insert({
      name: newTenant.name,
      domain: newTenant.domain,
    });
    setNewTenant({ name: "", domain: "" });
    setRefresh(x => x + 1);
  }

  return (
    <div className="bg-zinc-900 p-8 rounded-2xl max-w-4xl mx-auto shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-cyan-300">Admin dashboard (superadmin-only)</h2>
      <div className="flex gap-8">
        {/* Tenant beheer */}
        <form className="flex-1 flex flex-col gap-2" onSubmit={handleCreateTenant}>
          <h3 className="font-semibold text-lg text-cyan-200 mb-2">Tenant aanmaken</h3>
          <input className="bg-zinc-800 p-2 rounded" required placeholder="Tenant naam" value={newTenant.name} onChange={e => setNewTenant(v => ({ ...v, name: e.target.value }))} />
          <input className="bg-zinc-800 p-2 rounded" required placeholder="Domein (bv provide.nl)" value={newTenant.domain} onChange={e => setNewTenant(v => ({ ...v, domain: e.target.value }))} />
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded p-2 font-bold mt-2">Tenant opslaan</button>
        </form>
        {/* User beheer */}
        <form className="flex-1 flex flex-col gap-2" onSubmit={handleInviteUser}>
          <h3 className="font-semibold text-lg text-cyan-200 mb-2">Gebruiker uitnodigen</h3>
          <input className="bg-zinc-800 p-2 rounded" required placeholder="Email" value={newUser.email} onChange={e => setNewUser(v => ({ ...v, email: e.target.value }))} />
          <select className="bg-zinc-800 p-2 rounded" value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}>
            {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <select className="bg-zinc-800 p-2 rounded" required value={newUser.tenant_id} onChange={e => setNewUser(v => ({ ...v, tenant_id: e.target.value }))}>
            <option value="">Kies tenant</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.domain})</option>)}
          </select>
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded p-2 font-bold mt-2">Gebruiker uitnodigen</button>
        </form>
      </div>
      {/* Users overzicht */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2 text-cyan-200">Gebruikersoverzicht</h3>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Email</th><th>Rol</th><th>Tenant</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{tenants.find(t => t.id === u.tenant_id)?.name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
