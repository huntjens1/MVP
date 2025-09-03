import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

function initials(input: string): string {
  const base = String(input || "").trim();
  if (!base) return "?";
  // haal stuk vóór @ weg als het een e-mail is
  const name = base.replace(/@.*$/, "");
  const parts = name.split(/[.\s_-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? name[0];
  const second = parts[1]?.[0] ?? name[1] ?? "";
  return (first + second).toUpperCase();
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  // ✔ altijd een string
  const displayName =
    (user?.name && user.name.trim()) ||
    (user?.email && user.email.split("@")[0]) ||
    "Gebruiker";

  const email = user?.email ?? "";

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      nav("/auth", { replace: true });
    }
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <Link to="/app" style={{ textDecoration: "none", color: "inherit" }}>
        <strong>CallLogix</strong>
      </Link>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div
          title={email}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 }}
        >
          <span style={{ fontWeight: 600 }}>{displayName}</span>
          {email ? (
            <span style={{ fontSize: 12, color: "#6b7280" }}>{email}</span>
          ) : null}
        </div>

        <div
          aria-label="avatar"
          style={{
            width: 36,
            height: 36,
            borderRadius: "9999px",
            background: "#111827",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {initials(displayName)}
        </div>

        <button
          onClick={onLogout}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}
