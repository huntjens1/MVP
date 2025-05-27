import { LayoutDashboard, Mic, History } from "lucide-react";
import type { ReactNode } from "react";
import TopBar from "./TopBar";

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
    <div className="flex min-h-screen bg-calllogix-dark relative">
      <TopBar />
      {/* Sidebar */}
      <aside className="w-64 bg-calllogix-primary text-calllogix-text flex flex-col py-8 px-4 shadow-lg">
        <div className="text-2xl font-black tracking-wide mb-8 flex items-center gap-3">
          <span className="bg-calllogix-accent p-2 rounded-2xl">
            <LayoutDashboard size={32} />
          </span>
          <span>
            <span className="text-calllogix-text">Call</span>
            <span className="text-calllogix-accent">Logix</span>
          </span>
        </div>
        <nav className="flex-1">
          {TABS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg my-1 transition ${
                activeTab === name
                  ? "bg-calllogix-accent text-calllogix-dark font-bold shadow"
                  : "hover:bg-calllogix-accent/40 text-calllogix-text"
              }`}
            >
              <Icon size={22} />
              {name}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-10 text-xs text-calllogix-text/60">
          © {new Date().getFullYear()} CallLogix
        </div>
      </aside>
      {/* Main content (extra padding-top vanwege TopBar) */}
      <main className="flex-1 p-10 bg-calllogix-dark min-h-screen pt-24">
        {children}
      </main>
    </div>
  );
}
