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

const getInitials = (name) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

function BrandMark({ compact = false }) {
  return (
    <div
      className={`flex items-center gap-2 font-black uppercase italic tracking-tighter text-slate-900 dark:text-white ${
        compact ? "text-xl" : "text-3xl"
      }`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded bg-red-600 text-sm italic text-white">
        E
      </div>
      Engine
    </div>
  );
}

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

  const menuItems = [
    { name: t("nav.home"), path: "/", icon: <Home size={20} /> },
    { name: t("nav.dashboard"), path: "/dashboard", icon: <LayoutDashboard size={20} /> },
    { name: t("nav.garage"), path: "/garagem", icon: <Car size={20} /> },
    { name: t("nav.community"), path: "/community", icon: <Users size={20} /> },
    { name: t("nav.settings"), path: "/settings", icon: <Settings size={20} /> },
  ];

  const profileAvatar = (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 font-black italic text-white">
      {avatar ? (
        <img src={avatar} alt={displayName || "Perfil"} className="h-full w-full object-cover" />
      ) : (
        getInitials(displayName)
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden dark:border-[#181818] dark:bg-[#080808]/95">
        <BrandMark compact />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="h-9 w-9 overflow-hidden rounded-full"
            title={t("settings.sections.profile")}
          >
            {profileAvatar}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-gray-400 transition-colors hover:text-red-600"
            title={t("nav.logout")}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-gray-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden dark:border-[#181818] dark:bg-[#080808]/95">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-tight transition ${
                isActive
                  ? "bg-red-600 text-white"
                  : "text-gray-500 hover:text-red-600 dark:text-gray-400"
              }`}
            >
              {item.icon}
              <span className="w-full truncate text-center">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white p-8 transition-colors duration-300 lg:flex dark:border-[#181818] dark:bg-[#080808]">
        <div className="mb-12">
          <BrandMark />
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 rounded-xl px-4 py-4 font-bold transition-all duration-300 ${
                  isActive
                    ? "scale-105 bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-slate-900 dark:hover:bg-[#222] dark:hover:text-white"
                }`}
              >
                {item.icon}
                <span className="text-sm uppercase tracking-widest">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-8 dark:border-[#222]">
          <div className="flex min-w-0 items-center gap-3">
            {profileAvatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-black italic text-slate-900 dark:text-white">
                {displayName || t("settings.sections.profile")}
              </p>
              {showEmail && (
                <p className="truncate text-[9px] font-bold uppercase tracking-tighter text-gray-400">
                  {user?.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 text-gray-400 transition-colors hover:text-red-600"
            title={t("nav.logout")}
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>
    </>
  );
}
