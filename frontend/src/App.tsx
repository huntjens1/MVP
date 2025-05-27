import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayoutRouter from "./components/DashboardLayoutRouter";
import DashboardHome from "./components/DashboardHome";
import CallLogixTranscriptie from "./components/CallLogixTranscriptie";
import OpnameGeschiedenis from "./components/OpnameGeschiedenis";
import ResetPassword from "./components/ResetPassword";
import AuthPanel from "./components/AuthPanel";
import LandingPage from "./LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publieke routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPanel />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Beveiligde dashboardroutes */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <DashboardLayoutRouter />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="transcriptie" element={<CallLogixTranscriptie />} />
          <Route path="geschiedenis" element={<OpnameGeschiedenis />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
