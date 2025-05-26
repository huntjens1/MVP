import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import App from "./App";
import ResetPassword from "./components/ResetPassword";

// Hash-based invite/reset: redirect root met hash naar /reset-password
if (
  typeof window !== "undefined" &&
  window.location.pathname === "/" &&
  window.location.hash.includes("access_token")
) {
  const hash = window.location.hash.substring(1); // zonder '#'
  window.location.replace(`/reset-password?${hash}`);
}

export default function Root() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/confirm" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<ResetPassword />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
