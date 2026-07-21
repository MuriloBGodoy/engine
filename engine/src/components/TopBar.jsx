import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Moon, Sun } from "lucide-react";
import { engineDB } from "../services/db";
import { NotificationsPanel } from "./NotificationsPanel";
import { getNotificationTarget } from "../services/notifications";

function TopbarIconButton({ onClick, title, active = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        active
          ? "bg-[var(--engine-accent)] text-white"
          : "text-[var(--engine-text-muted)] hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Topbar({ settings, onSettingsUpdate, user }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const currentTheme = settings.preferences.theme;
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  useEffect(() => {
    if (!user?.uid) return undefined;
    return engineDB.subscribeNotifications(user.uid, setNotifications);
  }, [user?.uid]);

  const handleToggleTheme = async () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    const updatedSettings = {
      ...settings,
      preferences: { ...settings.preferences, theme: nextTheme },
    };

    onSettingsUpdate(updatedSettings);
    await engineDB.saveSettings(updatedSettings);
  };

  const markAllRead = () => {
    engineDB
      .markNotificationsRead(user?.uid)
      .catch((error) => console.error(error));
  };

  // As notificações só são marcadas como lidas ao FECHAR o painel: assim o
  // usuário ainda enxerga o que era novidade enquanto lê a lista.
  const closeNotifications = () => {
    setNotificationsOpen(false);
    if (unreadCount > 0) markAllRead();
  };

  const handleNotificationClick = (notification) => {
    const target = getNotificationTarget(notification);
    closeNotifications();
    if (target) navigate(target);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <TopbarIconButton
          onClick={() => setNotificationsOpen(true)}
          title={t("notifications.title")}
          active={notificationsOpen}
        >
          <Bell size={21} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--engine-accent)] px-1 text-[9px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </TopbarIconButton>

        <TopbarIconButton
          onClick={handleToggleTheme}
          title={
            currentTheme === "dark"
              ? t("settings.options.light")
              : t("settings.options.dark")
          }
        >
          {currentTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </TopbarIconButton>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        onClose={closeNotifications}
        onSelect={handleNotificationClick}
        onMarkAllRead={markAllRead}
      />
    </>
  );
}
