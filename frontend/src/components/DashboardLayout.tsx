import { Outlet, NavLink } from "react-router-dom";
import TopBar from "./TopBar";

export default function DashboardLayout() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        height: "100vh",
        background: "#f9fafb",
      }}
    >
      <aside
        style={{
          background: "#153b85",
          color: "white",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 22, display: "flex", gap: 10 }}>
          <span>🧩</span>
          <span>CallLogix</span>
        </div>

        <nav style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <NavLink to="/app" end style={linkStyle}>
            Dashboard
          </NavLink>
          <NavLink to="/app/transcriptie" style={linkStyle}>
            Nieuwe opname
          </NavLink>
          <NavLink to="/app/geschiedenis" style={linkStyle}>
            Opname geschiedenis
          </NavLink>
          {/* voeg hier evt. meer items toe */}
        </nav>

        <div style={{ marginTop: "auto", opacity: 0.7, fontSize: 12 }}>
          © {new Date().getFullYear()} CallLogix
        </div>
      </aside>

      <main
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          minWidth: 0,
          background: "white",
        }}
      >
        {/* TopBar hoort in de rechter kolom */}
        <TopBar />
        <div style={{ padding: 24, overflow: "auto", minWidth: 0 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function linkStyle({ isActive }: { isActive: boolean }) {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: 8,
    color: "white",
    textDecoration: "none",
    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
    fontWeight: isActive ? 700 : 500,
  } as React.CSSProperties;
}
