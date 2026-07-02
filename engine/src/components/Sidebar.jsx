import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Car,
  Home,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useTranslation } from "react-i18next";

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  profileSettings = {},
  privacySettings = {},
}) {
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
    { name: t("nav.dashboard"), path: "/dashboard", icon: <LayoutDashboard size={20} /> },
    { name: t("nav.garage"), path: "/garagem", icon: <Car size={20} /> },
    { name: t("nav.community"), path: "/community", icon: <Users size={20} /> },
    { name: t("nav.settings"), path: "/settings", icon: <Settings size={20} /> },
  ];

  return (
    <aside
      className={`flex w-full shrink-0 flex-col border-b border-gray-200 bg-white p-3 transition-all duration-300 lg:h-screen lg:border-b-0 lg:border-r dark:border-[#181818] dark:bg-[#080808] ${
        collapsed ? "lg:w-24 lg:p-5" : "lg:w-72 lg:p-8"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-xl font-black uppercase italic tracking-tighter text-slate-900 lg:mb-12 lg:text-3xl dark:text-white">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-red-600 text-sm text-white">
            E
          </div>
          {!collapsed && <span className="hidden truncate lg:inline">ENGINE</span>}
          <span className="truncate lg:hidden">ENGINE</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-red-600 lg:flex dark:hover:bg-[#181818]"
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="hide-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden lg:block lg:flex-1 lg:space-y-2 lg:overflow-visible">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 font-bold transition-all duration-300 lg:gap-4 lg:px-4 lg:py-4 ${
                collapsed ? "lg:justify-center" : ""
              } ${
                isActive
                  ? "bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)] lg:scale-105"
                  : "text-gray-500 hover:bg-gray-100 hover:text-slate-900 dark:hover:bg-[#222] dark:hover:text-white"
              }`}
            >
              {item.icon}
              <span
                className={`text-xs uppercase tracking-widest lg:text-sm ${
                  collapsed ? "lg:hidden" : ""
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden items-center justify-between border-t border-gray-200 pt-8 lg:flex dark:border-[#222]">
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 font-black italic text-white">
            {avatar ? (
              <img src={avatar} alt={displayName || "Perfil"} className="h-full w-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          {!collapsed && (
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
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 text-gray-400 transition-colors hover:text-red-600"
            title={t("nav.logout")}
          >
            <LogOut size={20} />
          </button>
        )}
      </div>
    </aside>
  );
}
