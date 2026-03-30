import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Car, Home, Settings, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser; // Pega o usuário logado agora

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  // Pega as iniciais do nome (ex: Murilo Bueno -> MB)
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
    <aside className="w-72 bg-white dark:bg-[#080808] border-r border-gray-200 dark:border-[#181818] p-8 flex flex-col transition-colors duration-300">
      <div className="text-3xl font-black italic mb-12 text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
        <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center italic text-sm text-white">
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
                  : "text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#222]"
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

      <div className="mt-auto pt-8 border-t border-gray-200 dark:border-[#222] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-black text-white italic">
            {getInitials(user?.displayName)}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white italic">
              {user?.displayName || "Usuário"}
            </p>
            {/* Removi o cargo e coloquei o email como sub-texto, fica mais clean */}
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
