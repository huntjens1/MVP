import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function AuthPanel() {
  const { isLoading, user, login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/app", { replace: true });
    }
  }, [isLoading, user, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login mislukt");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tenantId) return setError("Tenant ID verplicht");
    try {
      await register(email, password, tenantId);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registratie mislukt");
    }
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
            autoComplete="username"
          />
          <input
            type="password"
            required
            placeholder="Wachtwoord"
            className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {isRegister && (
            <input
              type="text"
              required
              placeholder="Tenant ID"
              className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
            />
          )}
          {error && <div className="text-red-500 font-bold">{error}</div>}
          <button
            type="submit"
            className="bg-calllogix-primary text-calllogix-text font-bold px-4 py-2 rounded-xl hover:bg-calllogix-accent hover:text-calllogix-dark transition"
            disabled={isLoading}
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
