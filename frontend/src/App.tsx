import { BrowserRouter, Routes, Route } from "react-router-dom";
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
    <BrowserRouter>
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
          {/* Subroutes voor /app/* */}
          <Route index element={<DashboardHome />} />
          <Route path="transcriptie" element={<CallLogixTranscriptie />} />
          <Route path="geschiedenis" element={<OpnameGeschiedenis />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="/app/analytics" element={<Analytics />} />
          <Route path="/app/conversations/:id" element={<ConversationDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
