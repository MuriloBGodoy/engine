import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, Home, Settings, LogOut } from "lucide-react";

export function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { name: "Home", path: "/", icon: <Home size={20} /> },
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    { name: "Garagem", path: "/garagem", icon: <Car size={20} /> },
    { name: "Configurações", path: "/settings", icon: <Settings size={20} /> },
  ];

  return (
    <aside className="w-64 bg-[#181818] border-r border-[#222] p-8 flex flex-col h-screen">
      {/* LOGO */}
      <div className="text-3xl font-black italic mb-12 text-white uppercase tracking-tighter flex items-center gap-2">
        <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center italic text-sm">
          E
        </div>
        ENGINE
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-4 rounded-xl font-bold transition-all duration-300 ${
                isActive
                  ? "bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)] scale-105"
                  : "text-gray-500 hover:text-white hover:bg-[#222]"
              }`}
            >
              {item.icon}
              <span className="text-sm uppercase tracking-widest">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-[#222] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-black text-white italic">
            MU
          </div>
          <div>
            <p className="text-sm font-black text-white italic">Murilo</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
              Estagiário
            </p>
          </div>
        </div>
        <button className="text-gray-600 hover:text-red-600 transition-colors">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
