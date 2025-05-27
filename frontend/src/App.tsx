import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayoutRouter from "./components/DashboardLayoutRouter";
import DashboardHome from "./components/DashboardHome";
import CallLogixTranscriptie from "./components/CallLogixTranscriptie";
import OpnameGeschiedenis from "./components/OpnameGeschiedenis";
import ResetPassword from "./components/ResetPassword";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<DashboardLayoutRouter />}>
          <Route index element={<DashboardHome />} />
          <Route path="transcriptie" element={<CallLogixTranscriptie />} />
          <Route path="geschiedenis" element={<OpnameGeschiedenis />} />
        </Route>
        {/* Auth/wachtwoord reset buiten layout */}
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}
