import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Car,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useTranslation } from "react-i18next";

export function Sidebar({ profileSettings = {}, privacySettings = {} }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const displayName = profileSettings.displayName || user?.displayName;
  const avatar = profileSettings.avatar || user?.photoURL;
  const showEmail = privacySettings.showEmailInSidebar !== false;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

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
    { name: t("nav.home"), path: "/", icon: <Home size={20} /> },
    {
      name: t("nav.dashboard"),
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    { name: t("nav.garage"), path: "/garagem", icon: <Car size={20} /> },
    {
      name: t("nav.community"),
      path: "/community",
      icon: <Users size={20} />,
    },
    { name: t("nav.settings"), path: "/settings", icon: <Settings size={20} /> },
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
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-red-600 rounded-full flex shrink-0 items-center justify-center font-black text-white italic overflow-hidden">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName || "Perfil"}
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white italic truncate">
              {displayName || t("settings.sections.profile")}
            </p>
            {showEmail && (
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter truncate">
                {user?.email}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
          title={t("nav.logout")}
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
