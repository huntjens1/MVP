import { useLocation, useNavigate, Outlet } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";

const TAB_MAP: Record<string, string> = {
  "/app": "Dashboard",
  "/app/transcriptie": "Nieuwe opname",
  "/app/geschiedenis": "Opname geschiedenis",
  "/app/admin": "Gebruikersbeheer",
};

export default function DashboardLayoutRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = TAB_MAP[location.pathname] || "Dashboard";

  function setTab(tab: string) {
    if (tab === "Dashboard") navigate("/app");
    else if (tab === "Nieuwe opname") navigate("/app/transcriptie");
    else if (tab === "Opname geschiedenis") navigate("/app/geschiedenis");
    else if (tab === "Gebruikersbeheer") navigate("/app/admin");
  }

  return (
    <DashboardLayout activeTab={activeTab} setTab={setTab}>
      <Outlet />
    </DashboardLayout>
  );
}
