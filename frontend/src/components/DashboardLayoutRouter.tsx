import DashboardLayout from "./DashboardLayout";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const TAB_MAP: Record<string, string> = {
  "/app": "Dashboard",
  "/app/transcriptie": "Nieuwe opname",
  "/app/geschiedenis": "Opname geschiedenis",
};

export default function DashboardLayoutRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  // Zorg dat bij nested paths (zoals /app/) altijd correct gemapt wordt
  const base = location.pathname.startsWith("/app/") && location.pathname !== "/app"
    ? `/app/${location.pathname.split("/")[2] || ""}`.replace(/\/$/, "")
    : location.pathname;
  const activeTab = TAB_MAP[base] || "Dashboard";

  function setTab(tab: string) {
    if (tab === "Dashboard") navigate("/app");
    else if (tab === "Nieuwe opname") navigate("/app/transcriptie");
    else if (tab === "Opname geschiedenis") navigate("/app/geschiedenis");
  }

  return (
    <DashboardLayout activeTab={activeTab} setTab={setTab}>
      <Outlet />
    </DashboardLayout>
  );
}
