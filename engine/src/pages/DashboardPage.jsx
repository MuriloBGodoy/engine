export function DashboardPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-black italic text-white uppercase mb-10">
        Analytics & Performance
      </h1>
      <div className="bg-[#181818] border border-[#222] rounded-3xl p-20 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-600/20">
          <span className="text-red-600 text-2xl animate-pulse">📊</span>
        </div>
        <p className="text-gray-400 font-bold italic uppercase tracking-[0.3em] text-center">
          E-Charts Integration <br />
          <span className="text-gray-600 text-xs">Under Construction</span>
        </p>
      </div>
    </div>
  );
}
