import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Car,
  BriefcaseBusiness,
  Home,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { Topbar } from "./TopBar";

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
 * Navegação mobile compartilhada pelos dois layouts (sidebar e top-nav):
 * header fixo no topo + barra de abas fixa embaixo. Só aparece em telas < lg.
 *
 * A barra de baixo leva as 5 áreas principais — com 6 itens os rótulos
 * ("Comunidade", "Configurações") não cabem num celular de 360px e viravam
 * texto cortado. Ajustes ficam no header, junto do avatar.
 */
export function MobileNav({
  profileSettings = {},
  settings,
  onSettingsUpdate,
  user,
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = user || auth.currentUser;
  const displayName = profileSettings.displayName || currentUser?.displayName;
  const avatar = profileSettings.avatar || currentUser?.photoURL;

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
    { name: t("nav.services"), path: "/services", icon: BriefcaseBusiness },
  ];

  const isActivePath = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const settingsActive = location.pathname.startsWith("/settings");

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-[var(--engine-border)] bg-[var(--engine-bg)]/85 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <Link to="/" className="min-w-0 shrink" aria-label="Engine">
          <Logo markSize={28} />
        </Link>

        <div className="flex shrink-0 items-center gap-0.5">
          {settings && onSettingsUpdate && (
            <Topbar
              settings={settings}
              onSettingsUpdate={onSettingsUpdate}
              user={currentUser}
            />
          )}
          {/* O avatar é a porta de entrada de Ajustes no mobile (mesmo padrão
              da sidebar no desktop) — ganha anel de destaque quando ativo. */}
          <Link
            to="/settings"
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
            aria-current={settingsActive ? "page" : undefined}
            className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--engine-accent)] text-xs font-bold text-white transition-transform active:scale-95 ${
              settingsActive
                ? "ring-2 ring-[var(--engine-accent)] ring-offset-2 ring-offset-[var(--engine-bg)]"
                : ""
            }`}
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
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--engine-text-subtle)] transition-colors active:text-[var(--engine-accent)]"
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[var(--engine-border)] bg-[var(--engine-bg)]/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden">
        {menuItems.map((item) => {
          const active = isActivePath(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1 text-[10px] font-semibold transition-colors ${
                active
                  ? "text-[var(--engine-accent)]"
                  : "text-[var(--engine-text-subtle)]"
              }`}
            >
              <span
                className={`flex h-7 w-full max-w-14 items-center justify-center rounded-lg transition-colors ${
                  active ? "bg-[var(--engine-accent-soft)]" : ""
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="w-full truncate text-center leading-none">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
