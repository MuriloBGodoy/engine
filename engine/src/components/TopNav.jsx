import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Car,
  BriefcaseBusiness,
  Calendar,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useTranslation } from "react-i18next";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import { Logo } from "./Logo";
import { Topbar } from "./TopBar";
import { GuestLoginHint } from "./GuestLoginHint";
import { RegionPicker } from "./RegionPicker";

const getInitials = (name) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Layout de navegação horizontal (alternativa à Sidebar). Desktop-only —
 * no mobile continua valendo o MobileNav. Embute as ações globais
 * (notificações, tema, idioma) da Topbar à direita.
 */
export function TopNav({
  settings,
  onSettingsUpdate,
  user,
  profileSettings = {},
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isGuest = !user;
  const displayName = profileSettings.displayName || user?.displayName;
  const avatar = profileSettings.avatar || user?.photoURL;
  const username = profileSettings.username || user?.email?.split("@")[0] || "";
  const unreadMessages = useUnreadMessages(user?.uid);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  const menuItems = [
    { name: t("nav.home"), path: "/", icon: Home },
    { name: t("nav.dashboard"), path: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.garage"), path: "/garagem", icon: Car },
    { name: t("nav.community"), path: "/community", icon: Users },
    {
      name: t("nav.messages"),
      path: "/messages",
      icon: MessageCircle,
      badge: unreadMessages,
    },
    { name: t("nav.services"), path: "/services", icon: BriefcaseBusiness },
    { name: "Eventos", path: "/events", icon: Calendar },
    { name: t("nav.settings"), path: "/settings", icon: Settings },
  ];

  const isActivePath = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--engine-border)] bg-[var(--engine-bg)]/85 backdrop-blur-xl lg:block">
      <div className="engine-container flex h-16 items-center gap-4 px-6 lg:px-10">
        <Link to="/" className="shrink-0">
          <Logo markSize={30} />
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {menuItems.map((item) => {
            const active = isActivePath(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                    : "text-[var(--engine-text-muted)] hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
                }`}
              >
                <span className="relative">
                  <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                  {item.badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-[var(--engine-accent)]" />
                  )}
                </span>
                <span className="hidden xl:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <RegionPicker className="mr-1" />
          {isGuest ? (
            <div className="relative">
              <Link
                to="/login"
                title={t("nav.login")}
                className="flex h-9 items-center gap-2 rounded-full bg-[var(--engine-accent)] px-4 text-[13px] font-semibold text-white transition hover:brightness-95"
              >
                <LogIn size={17} />
                {t("nav.login")}
              </Link>
              <GuestLoginHint placement="bottom-right" />
            </div>
          ) : (
            <>
              <Topbar
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
                user={user}
              />
              <span className="mx-1.5 h-6 w-px bg-[var(--engine-border)]" />
              <Link
                to={username ? `/profile/${username.replace(/^@/, "")}` : "/community"}
                title={t("settings.sections.profile")}
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--engine-accent)] text-xs font-bold text-white transition-transform active:scale-95"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName || "Perfil"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(displayName)
                )}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-accent-soft)] hover:text-[var(--engine-accent)]"
                title={t("nav.logout")}
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
