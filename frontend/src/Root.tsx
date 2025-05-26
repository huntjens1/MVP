import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ResetPassword from "./components/ResetPassword";

export default function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/confirm" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}
