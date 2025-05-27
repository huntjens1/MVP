import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayoutRouter from "./components/DashboardLayoutRouter";
import DashboardHome from "./components/DashboardHome";
import CallLogixTranscriptie from "./components/CallLogixTranscriptie";
import OpnameGeschiedenis from "./components/OpnameGeschiedenis";
import ResetPassword from "./components/ResetPassword";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<DashboardLayoutRouter />}>
          <Route index element={<DashboardHome />} />
          <Route path="transcriptie" element={<CallLogixTranscriptie />} />
          <Route path="geschiedenis" element={<OpnameGeschiedenis />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}
