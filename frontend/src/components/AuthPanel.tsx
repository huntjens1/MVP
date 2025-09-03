import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function AuthPanel() {
  const { isLoading, user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate("/app", { replace: true });
  }, [isLoading, user, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password); // backend zet clx_tenant cookie obv e-maildomein
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login mislukt");
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-calllogix-dark text-calllogix-text items-center justify-center">
      <div className="max-w-md w-full p-8 bg-calllogix-card rounded-2xl shadow-2xl flex flex-col gap-6 mt-24">
        <h1 className="text-3xl font-black text-calllogix-primary text-center">Inloggen</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
          <input
            type="email" required placeholder="E-mailadres"
            className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
          />
          <input
            type="password" required placeholder="Wachtwoord"
            className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          />
          {error && <div className="text-red-500 font-bold">{error}</div>}
          <button
            type="submit"
            className="bg-calllogix-primary text-calllogix-text font-bold px-4 py-2 rounded-xl hover:bg-calllogix-accent hover:text-calllogix-dark transition"
            disabled={isLoading}
          >
            Inloggen
          </button>
          {isLoading && <div className="text-calllogix-subtext text-sm">Bezig met laden...</div>}
        </form>

        <div className="flex flex-col gap-2">
          <Link to="/" className="text-calllogix-primary underline text-sm font-semibold text-center">
            ← Terug naar landingspagina
          </Link>
        </div>
      </div>
    </main>
  );
}
