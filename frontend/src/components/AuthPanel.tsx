import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function AuthPanel() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email, password);
      if (!u) throw new Error("Login mislukt.");
      // Belangrijk: naar /app (niet /dashboard)
      const dest = (loc.state as any)?.from?.pathname || "/app";
      nav(dest, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "64px auto", padding: 24, border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700 }}>Inloggen</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="jij@bedrijf.nl"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Wachtwoord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        {error ? <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div> : null}

        <button
          disabled={submitting}
          type="submit"
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid transparent",
            background: submitting ? "#9ca3af" : "#111827",
            color: "white",
            cursor: submitting ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "Bezig..." : "Inloggen"}
        </button>
      </form>
    </div>
  );
}
