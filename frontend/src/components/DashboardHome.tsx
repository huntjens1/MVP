export default function DashboardHome() {
  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Dashboard</h1>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Statistiek/placeholder cards */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
          <span className="text-blue-700 dark:text-blue-400 mb-2">●</span>
          <div className="text-3xl font-bold">–</div>
          <div className="text-sm mt-2 text-zinc-500">Live Opnames</div>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow flex flex-col items-center">
          <span className="text-blue-700 dark:text-blue-400 mb-2">●</span>
          <div className="text-3xl font-bold">–</div>
          <div className="text-sm mt-2 text-zinc-500">Opname Geschiedenis</div>
        </div>
      </div>
    </>
  );
}
