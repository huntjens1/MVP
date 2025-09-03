import { Routes, Route, Navigate } from "react-router-dom";
import AuthPanel from "./components/AuthPanel";
import DashboardLayoutRouter from "./components/DashboardLayoutRouter";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./LandingPage";
import AdminDashboard from "./components/AdminDashboard";
import CallLogixTranscriptie from "./components/CallLogixTranscriptie";
import OpnameGeschiedenis from "./components/OpnameGeschiedenis";
import DashboardHome from "./components/DashboardHome";
import Analytics from "./components/Analytics";
import ConversationDetail from "./components/ConversationDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPanel />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayoutRouter />
          </ProtectedRoute>
        }
      >
        {/* alle subroutes RELATIEF houden, zodat ze ProtectedRoute erven */}
        <Route index element={<DashboardHome />} />
        <Route path="transcriptie" element={<CallLogixTranscriptie />} />
        <Route path="geschiedenis" element={<OpnameGeschiedenis />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="conversations/:id" element={<ConversationDetail />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}
