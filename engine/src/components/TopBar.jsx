import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Translate as TranslateIcon,
} from "@mui/icons-material";
import {
  Bell,
  CheckCircle2,
  Heart,
  MessageCircle,
  RotateCcw,
  Star,
  UserPlus,
  XCircle,
} from "lucide-react";
import { engineDB } from "../services/db";
import { languageOptions } from "../services/languages";

const notificationLabels = {
  follow: "Novo seguidor",
  like: "Curtida",
  comment: "Comentário",
  rating: "Avaliação",
  service_approved: "Anúncio aprovado",
  service_changes_requested: "Anúncio retornado",
  service_rejected: "Anúncio recusado",
};

const notificationStyles = {
  follow: {
    icon: UserPlus,
    iconClass: "text-sky-500",
    badgeClass: "text-sky-500",
  },
  like: {
    icon: Heart,
    iconClass: "text-red-500",
    badgeClass: "text-red-500",
  },
  comment: {
    icon: MessageCircle,
    iconClass: "text-violet-500",
    badgeClass: "text-violet-500",
  },
  rating: {
    icon: Star,
    iconClass: "text-amber-500",
    badgeClass: "text-amber-500",
  },
  service_approved: {
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    badgeClass: "text-emerald-500",
  },
  service_changes_requested: {
    icon: RotateCcw,
    iconClass: "text-sky-500",
    badgeClass: "text-sky-500",
  },
  service_rejected: {
    icon: XCircle,
    iconClass: "text-red-500",
    badgeClass: "text-red-500",
  },
};

const defaultNotificationStyle = {
  icon: Bell,
  iconClass: "text-slate-500",
  badgeClass: "text-slate-500",
};

const formatNotificationTime = (createdAt) => {
  const date = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!date || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getNotificationTarget = (notification) => {
  if (notification.targetPath) return notification.targetPath;
  if (notification.goalId) return `/community?goal=${encodeURIComponent(notification.goalId)}`;
  if (notification.serviceId) return "/services";
  if (["follow", "like", "comment", "rating"].includes(notification.type)) {
    return "/community";
  }
  return "";
};

const getNotificationCopy = (notification) => {
  if (notification.notificationTitle || notification.notificationBody) {
    return {
      title:
        notification.notificationTitle ||
        notificationLabels[notification.type] ||
        "Notificação",
      body: notification.notificationBody || "",
    };
  }

  if (notification.type === "service_approved") {
    return { title: "Anúncio aprovado", body: "Seu anúncio foi publicado." };
  }
  if (notification.type === "service_changes_requested") {
    return {
      title: "Alterações solicitadas",
      body: "Revise os comentários do admin.",
    };
  }
  if (notification.type === "service_rejected") {
    return { title: "Anúncio recusado", body: "Confira o motivo enviado." };
  }
  if (notification.type === "like") {
    return { title: "Nova curtida", body: `${notification.actorName || "Alguém"} curtiu sua publicação.` };
  }
  if (notification.type === "comment") {
    return { title: "Novo comentário", body: `${notification.actorName || "Alguém"} comentou na sua publicação.` };
  }
  if (notification.type === "rating") {
    return { title: "Nova avaliação", body: `${notification.actorName || "Alguém"} avaliou sua publicação.` };
  }
  if (notification.type === "follow") {
    return { title: "Novo seguidor", body: `${notification.actorName || "Alguém"} começou a seguir você.` };
  }

  return {
    title: notificationLabels[notification.type] || "Notificação",
    body: notification.text || "",
  };
};

export function Topbar({ settings, onSettingsUpdate, user }) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const currentTheme = settings.preferences.theme;
  const isDark = currentTheme === "dark";
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!user?.uid) return undefined;
    return engineDB.subscribeNotifications(user.uid, setNotifications);
  }, [user?.uid]);

  const handleToggleTheme = async () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    const updatedSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        theme: nextTheme,
      },
    };

    onSettingsUpdate(updatedSettings);
    await engineDB.saveSettings(updatedSettings);
  };

  const handleChangeLanguage = async (lng) => {
    const updatedSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        language: lng,
      },
    };

    onSettingsUpdate(updatedSettings);
    i18n.changeLanguage(lng);
    await engineDB.saveSettings(updatedSettings);
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
    engineDB.markNotificationsRead(user?.uid).catch((error) => console.error(error));
  };

  const handleNotificationClick = (notification) => {
    const target = getNotificationTarget(notification);
    setNotificationsAnchor(null);
    if (target) navigate(target);
  };

  return (
    <div className="flex w-full items-center justify-end gap-3 border-b border-slate-200/60 pb-4 dark:border-slate-800/50">
      <Tooltip title={t("notifications.title")}>
        <button
          type="button"
          onClick={handleNotificationsOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-red-500/10 hover:text-red-600 dark:text-white"
        >
          <Bell size={21} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      <Tooltip title={currentTheme === "dark" ? "Modo Claro" : "Modo Escuro"}>
        <IconButton
          onClick={handleToggleTheme}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.08)",
            },
          }}
        >
          {currentTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Alterar idioma">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.08)",
            },
          }}
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={() => setNotificationsAnchor(null)}
        disableScrollLock
        slotProps={{
          paper: {
            className:
              "mt-2 w-[min(94vw,440px)] max-h-[76vh] overflow-hidden bg-white dark:bg-[#080808] text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl",
            sx: {
              backgroundColor: isDark ? "#080808" : "#ffffff",
              color: isDark ? "#ffffff" : "#0f172a",
              border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
              boxShadow: isDark
                ? "0 24px 70px rgba(0,0,0,0.55)"
                : "0 24px 70px rgba(15,23,42,0.18)",
            },
          },
        }}
      >
        <div
          className="flex items-center justify-between gap-4 border-b px-4 py-3"
          style={{ borderColor: isDark ? "#1e293b" : "#f1f5f9" }}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">
              {t("notifications.title")}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {unreadCount
                ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`
                : "Nenhuma notificação pendente"}
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {notifications.length ? (
          <div className="max-h-[58vh] overflow-y-auto">
            {notifications.slice(0, 12).map((notification) => {
              const style =
                notificationStyles[notification.type] || defaultNotificationStyle;
              const Icon = style.icon;
              const createdAt = formatNotificationTime(notification.createdAt);
              const copy = getNotificationCopy(notification);
              const target = getNotificationTarget(notification);

              return (
                <MenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="block whitespace-normal rounded-xl p-0"
                  sx={{
                    display: "block",
                    whiteSpace: "normal",
                    padding: 0,
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    "&:hover": {
                      backgroundColor: isDark ? "#101010" : "#f8fafc",
                    },
                  }}
                >
                  <div
                    className={`relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b px-4 py-3 transition ${
                      notification.read
                        ? "border-slate-100 bg-white dark:border-[#171717] dark:bg-[#080808]"
                        : "border-slate-100 bg-slate-50 dark:border-[#171717] dark:bg-[#0e0e0e]"
                    }`}
                  >
                    {!notification.read && (
                      <span className="absolute left-0 top-0 h-full w-0.5 bg-red-600" />
                    )}
                    <div className="pt-0.5">
                      <Icon className={style.iconClass} size={18} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span
                          className={`min-w-0 truncate text-[10px] font-black uppercase tracking-[0.16em] ${style.badgeClass}`}
                        >
                          {copy.title}
                        </span>
                        {createdAt && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                            {createdAt}
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-1 text-sm font-semibold leading-5"
                        style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                      >
                        {copy.body}
                      </p>
                      {notification.goalTitle && !notification.moderationNote && (
                        <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {notification.goalTitle}
                        </p>
                      )}
                      {notification.moderationNote && (
                        <div className="mt-2 border-l-2 border-red-500/60 bg-red-500/[0.06] px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-500">
                            Comentário do admin
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-gray-700 dark:text-gray-300">
                            {notification.moderationNote}
                          </p>
                        </div>
                      )}
                      {notification.actorUsername && (
                        <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                          {notification.actorUsername}
                        </p>
                      )}
                      {target && (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                          Abrir
                        </p>
                      )}
                    </div>
                  </div>
                </MenuItem>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 dark:border-[#222] dark:text-gray-500">
              <Bell size={18} />
            </div>
            <p className="mt-4 text-sm font-black uppercase text-slate-950 dark:text-white">
              {t("notifications.empty")}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">
              Quando algo importante acontecer, o alerta aparece aqui.
            </p>
          </div>
        )}
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        disableScrollLock
        slotProps={{
          paper: {
            className:
              "mt-1 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-lg dark:border-slate-800 dark:bg-[#080808] dark:text-white",
            sx: {
              backgroundColor: isDark ? "#080808" : "#ffffff",
              color: isDark ? "#ffffff" : "#0f172a",
              border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
            },
          },
        }}
      >
        {languageOptions.map((option) => (
          <MenuItem
            key={option.value}
            selected={settings.preferences.language === option.value}
            onClick={() => handleChangeLanguage(option.value)}
          >
            <span className="mr-3 text-xs font-black uppercase tracking-widest text-red-500">
              {option.region}
            </span>
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
