import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../AuthContext";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

export default function AuthPanel() {
  const { isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = "/app"; // of je dashboard route
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else window.location.href = "/app";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-calllogix-dark">
      <form
        className="bg-calllogix-card p-8 rounded-2xl shadow-xl flex flex-col gap-4 w-full max-w-md"
        onSubmit={isRegister ? handleSignUp : handleSignIn}
      >
        <h2 className="text-2xl font-black text-calllogix-primary mb-2">
          {isRegister ? "Registreren" : "Inloggen"}
        </h2>
        <input
          type="email"
          required
          placeholder="E-mailadres"
          className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Wachtwoord"
          className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <div className="text-red-500 font-bold">{error}</div>}
        <button
          type="submit"
          className="bg-calllogix-primary text-calllogix-text font-bold px-4 py-2 rounded-xl hover:bg-calllogix-accent hover:text-calllogix-dark transition"
        >
          {isRegister ? "Registreren" : "Inloggen"}
        </button>
        <button
          type="button"
          onClick={() => setIsRegister(r => !r)}
          className="text-calllogix-accent underline text-sm"
        >
          {isRegister ? "Ik heb al een account" : "Account aanmaken"}
        </button>
        {isLoading && <div className="text-calllogix-subtext text-sm">Bezig met laden...</div>}
      </form>
    </div>
  );
}
