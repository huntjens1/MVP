import { LayoutDashboard, Mic, History } from "lucide-react";
import type { ReactNode } from "react";

const TABS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { name: "Nieuwe opname", icon: Mic, path: "/app/transcriptie" },
  { name: "Opname geschiedenis", icon: History, path: "/app/geschiedenis" },
];

type DashboardLayoutProps = {
  activeTab: string;
  setTab: (tab: string) => void;
  children: ReactNode;
};

export default function DashboardLayout({ activeTab, setTab, children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar */}
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
      {/* Main content */}
      <main className="flex-1 p-10 bg-zinc-50 dark:bg-zinc-900">
        {children}
      </main>
    </div>
  );
}
