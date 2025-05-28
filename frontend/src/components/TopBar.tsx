import { useAuth } from "../AuthContext";

export default function TopBar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="fixed z-50 right-0 top-0 w-full flex justify-end p-4 bg-calllogix-dark bg-opacity-90 shadow"
         style={{ minHeight: 64 }}>
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-calllogix-card text-calllogix-accent border border-calllogix-primary shadow">
          <span className="text-calllogix-primary text-lg">👤</span>
          {user.email}
          <span className="ml-2 px-2 py-1 rounded-lg bg-calllogix-accent text-calllogix-dark text-xs capitalize font-bold border border-calllogix-accent/40">{user.role}</span>
        </span>
        <button
          className="px-3 py-2 rounded-xl font-bold bg-calllogix-primary text-calllogix-text hover:bg-calllogix-accent hover:text-calllogix-dark transition"
          onClick={logout}
        >
          Uitloggen
        </button>
      </span>
    </div>
  );
}
