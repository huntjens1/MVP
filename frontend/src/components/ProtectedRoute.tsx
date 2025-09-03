import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null; // evt. spinner
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  return <>{children}</>;
}
