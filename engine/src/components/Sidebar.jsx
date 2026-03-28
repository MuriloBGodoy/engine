import { Gauge, Car, Target, DollarSign, LogOut } from "lucide-react";

const navItems = [
  { name: "Dashboard", icon: Gauge },
  { name: "Garagem", icon: Car },
  { name: "Minhas Metas", icon: Target },
  { name: "Configurações", icon: DollarSign },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-[#121212] flex flex-col p-6 text-white border-r border-[#222]">
      <div className="flex items-center gap-3 mb-12">
        <h1 className="text-3xl font-black italic tracking-tighter text-white">
          ENGINE
        </h1>
      </div>

      <nav className="flex-1 space-y-3">
        {navItems.map((item, index) => {
          const isActive = index === 0;
          return (
            <a
              key={item.name}
              href="#"
              className={`flex items-center gap-4 px-4 py-3 rounded-lg font-bold transition-all hover:bg-red-950/30 ${
                isActive ? "text-red-500 bg-red-950/30" : "text-gray-300"
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${isActive ? "text-red-500" : ""}`}
              />
              {item.name}
            </a>
          );
        })}
      </nav>

      <div className="border-t border-[#222] pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600 font-black flex items-center justify-center text-white">
            MU
          </div>
          <div>
            <p className="font-bold">Murilo</p>
            <p className="text-xs text-gray-500">Estagiário</p>
          </div>
        </div>
        <button className="text-gray-500 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
