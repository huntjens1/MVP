import AuthPanel from "./components/AuthPanel";
import CallLogixTranscriptie from "./components/CallLogixTranscriptie";
import AdminDashboard from "./components/AdminDashboard";
import { useAuth } from "./AuthContext";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-cyan-950 px-2 py-8">
      <div className="max-w-3xl mx-auto">
        <AuthPanel />
        {user?.role === "superadmin" && <AdminDashboard />}
        {user && user.role !== "superadmin" && <CallLogixTranscriptie />}
        {!user && <div className="text-zinc-400 mt-12 text-center text-lg">Log in om CallLogix te gebruiken.</div>}
      </div>
    </div>
  );
}
