import { useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

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
    else window.location.href = "/app";
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else window.location.href = "/app";
  }

  return (
    <main className="flex flex-col min-h-screen bg-calllogix-dark text-calllogix-text items-center justify-center">
      <div className="max-w-md w-full p-8 bg-calllogix-card rounded-2xl shadow-2xl flex flex-col gap-8 mt-24">
        <h1 className="text-3xl font-black text-calllogix-primary text-center mb-2">
          {isRegister ? "Account aanmaken" : "Inloggen"}
        </h1>
        <form className="flex flex-col gap-4" onSubmit={isRegister ? handleSignUp : handleSignIn}>
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
            {isRegister ? "Account aanmaken" : "Inloggen"}
          </button>
          {isLoading && <div className="text-calllogix-subtext text-sm">Bezig met laden...</div>}
        </form>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsRegister(r => !r)}
            className="text-calllogix-accent underline text-sm"
          >
            {isRegister ? "Ik heb al een account" : "Account aanmaken"}
          </button>
          <Link
            to="/"
            className="text-calllogix-primary underline text-sm font-semibold text-center"
          >
            ← Terug naar landingspagina
          </Link>
        </div>
      </div>
    </main>
  );
}
