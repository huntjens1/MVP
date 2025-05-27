export default function DashboardHome() {
  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-calllogix-primary">Dashboard</h1>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Statistiek/placeholder cards */}
        <div className="bg-calllogix-card text-calllogix-text rounded-2xl p-6 shadow-lg flex flex-col items-center border border-calllogix-primary/20">
          <span className="text-calllogix-accent mb-2">●</span>
          <div className="text-3xl font-bold">–</div>
          <div className="text-sm mt-2 text-calllogix-subtext">Live Opnames</div>
        </div>
        <div className="bg-calllogix-card text-calllogix-text rounded-2xl p-6 shadow-lg flex flex-col items-center border border-calllogix-primary/20">
          <span className="text-calllogix-accent mb-2">●</span>
          <div className="text-3xl font-bold">–</div>
          <div className="text-sm mt-2 text-calllogix-subtext">Opname Geschiedenis</div>
        </div>
      </div>
    </>
  );
}
