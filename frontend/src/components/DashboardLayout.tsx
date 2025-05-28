import { LayoutDashboard, Mic, History, Users } from "lucide-react";
import { useAuth } from "../AuthContext";
import TopBar from "./TopBar";
import type { ReactNode } from "react";

const BASE_TABS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { name: "Nieuwe opname", icon: Mic, path: "/app/transcriptie" },
  { name: "Opname geschiedenis", icon: History, path: "/app/geschiedenis" },
];

export default function DashboardLayout({ activeTab, setTab, children }: {
  activeTab: string,
  setTab: (tab: string) => void,
  children: ReactNode
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const TABS = isSuperAdmin
    ? [
        ...BASE_TABS,
        { name: "Gebruikersbeheer", icon: Users, path: "/app/admin" },
      ]
    : BASE_TABS;

  return (
    <div className="flex min-h-screen bg-calllogix-dark relative">
      <TopBar />
      <aside className="w-64 bg-blue-900 text-white flex flex-col py-8 px-4 shadow-lg">
        <div className="text-2xl font-black tracking-wide mb-8 flex items-center gap-3">
          <span className="bg-blue-700 p-2 rounded-xl"><LayoutDashboard size={32} /></span>
          CallLogix
        </div>
        <nav className="flex-1">
          {TABS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg my-1 transition ${
                activeTab === name
                  ? "bg-blue-700 text-white font-bold shadow"
                  : "hover:bg-blue-800/70 text-blue-100"
              }`}
            >
              <Icon size={22} />
              {name}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-10 text-xs text-blue-200/60">
          © {new Date().getFullYear()} CallLogix
        </div>
      </aside>
      <main className="flex-1 p-10 bg-calllogix-dark min-h-screen pt-24">
        {children}
      </main>
    </div>
  );
}
