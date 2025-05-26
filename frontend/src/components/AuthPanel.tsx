import { useState } from "react";
import { useAuth } from "../AuthContext";

export default function AuthPanel() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div>⏳ Laden...</div>;
  if (user)
    return (
      <div className="flex flex-col items-end gap-2 mb-4">
        <div className="text-zinc-200 text-sm">Ingelogd als: <b>{user.email}</b> <span className="bg-cyan-700 text-xs px-2 py-0.5 rounded ml-2">{user.role}</span></div>
        <button onClick={signOut} className="bg-zinc-800 px-3 py-1 rounded text-cyan-300 hover:bg-zinc-900">Uitloggen</button>
      </div>
    );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        let error;
        if (mode === "login") {
          error = await signIn(email, pw);
        } else {
          error = await signUp(email, pw);
        }
        if (error) setErr(error.message || "Onbekende fout");
      }}
      className="bg-zinc-900 p-6 rounded-xl shadow-lg flex flex-col gap-2 max-w-sm"
    >
      <h2 className="font-bold text-lg mb-2 text-cyan-400">{mode === "login" ? "Inloggen" : "Account aanmaken"}</h2>
      <input className="bg-zinc-800 px-3 py-2 rounded text-zinc-100" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="bg-zinc-800 px-3 py-2 rounded text-zinc-100" type="password" placeholder="Wachtwoord" value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded font-bold mt-2">{mode === "login" ? "Log in" : "Maak account"}</button>
      <button type="button" className="text-xs text-zinc-400 mt-1" onClick={() => setMode(m => m === "login" ? "signup" : "login")}>
        {mode === "login" ? "Nieuw account maken" : "Al een account? Log in"}
      </button>
      {err && <div className="text-red-400 text-xs mt-1">{err}</div>}
    </form>
  );
}
