import { useState } from "react";
import { LayoutDashboard, Mic, History, Users } from "lucide-react";
import CallLogixTranscriptie from "./CallLogixTranscriptie";
import TopBar from "./TopBar";

const TABS = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Nieuwe opname", icon: Mic },
  { name: "Opname geschiedenis", icon: History },
  // { name: "Gebruikersbeheer", icon: Users },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("Dashboard");

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900 relative">
      <TopBar />
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
                tab === name
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

      {/* Main Content */}
      <main className="flex-1 p-10 bg-zinc-50 dark:bg-zinc-900 pt-24">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {tab}
          </h1>
        </header>

        {tab === "Dashboard" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><Mic size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Live Opnames</div>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><History size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Opname Geschiedenis</div>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
              <span className="text-blue-700 dark:text-blue-400 mb-2"><Users size={32} /></span>
              <div className="text-3xl font-bold">–</div>
              <div className="text-sm mt-2 text-zinc-500">Gebruikers</div>
            </div>
          </div>
        )}

        {tab === "Nieuwe opname" && (
          <CallLogixTranscriptie />
        )}

        {tab === "Opname geschiedenis" && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow">
            <h2 className="text-lg font-bold mb-4">Eerdere opnames (hier kun je straks een lijst tonen uit je database/Supabase)</h2>
            <div className="text-zinc-500">(Nog geen data gekoppeld)</div>
          </div>
        )}
      </main>
    </div>
  );
}
