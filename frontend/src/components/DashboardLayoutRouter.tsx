import DashboardLayout from "./DashboardLayout";

/**
 * Layout-only wrapper. Geen props/children doorgeven.
 * Routes worden in App.tsx genest onder /app en landen via <Outlet /> in DashboardLayout.
 */
export default function DashboardLayoutRouter() {
  return <DashboardLayout />;
}
