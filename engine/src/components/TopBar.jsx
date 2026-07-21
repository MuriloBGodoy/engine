import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  Heart,
  MessageCircle,
  Moon,
  RotateCcw,
  Star,
  Sun,
  UserPlus,
  XCircle,
} from "lucide-react";
import { engineDB } from "../services/db";

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

function useClickOutside(refs, onOutside) {
  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedInside = refs.some((ref) => ref.current?.contains(event.target));
      if (!clickedInside) onOutside();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [refs, onOutside]);
}

function TopbarIconButton({ onClick, title, active = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
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

export function Topbar({ settings, onSettingsUpdate, user, variant = "page" }) {
  const embedded = variant === "embedded";
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationsRef = useRef(null);

  const currentTheme = settings.preferences.theme;
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useClickOutside([notificationsRef], () => setNotificationsOpen(false));

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

  const handleNotificationsOpen = () => {
    setNotificationsOpen((current) => !current);
    engineDB.markNotificationsRead(user?.uid).catch((error) => console.error(error));
  };

  const handleNotificationClick = (notification) => {
    const target = getNotificationTarget(notification);
    setNotificationsOpen(false);
    if (target) navigate(target);
  };

  return (
    <div
      className={
        embedded
          ? "flex items-center gap-1"
          : "flex w-full items-center justify-end gap-1.5 border-b border-[var(--engine-border)] pb-4"
      }
    >
      <div ref={notificationsRef} className="relative">
        <TopbarIconButton
          onClick={handleNotificationsOpen}
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

        {notificationsOpen && (
          /* No mobile o painel é ancorado na viewport (o sino fica no meio do
             header, então "right-0" jogaria metade do painel para fora da
             tela); no desktop volta a ser um popover preso ao botão. */
          <div className="engine-pop fixed inset-x-3 top-[4.25rem] z-50 max-h-[76vh] overflow-hidden rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] text-[var(--engine-text)] shadow-[var(--engine-shadow-lg)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(94vw,440px)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--engine-border)] px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--engine-accent)]">
                  {t("notifications.title")}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--engine-text-subtle)]">
                  {unreadCount
                    ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`
                    : "Nenhuma notificação pendente"}
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--engine-accent)] px-2.5 py-1 text-[10px] font-black text-white">
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
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="block w-full text-left"
                    >
                      <div
                        className={`relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-[var(--engine-border)] px-4 py-3 transition hover:bg-[var(--engine-surface-2)] ${
                          notification.read
                            ? "bg-transparent"
                            : "bg-[var(--engine-accent-soft)]"
                        }`}
                      >
                        {!notification.read && (
                          <span className="absolute left-0 top-0 h-full w-0.5 bg-[var(--engine-accent)]" />
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
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                                {createdAt}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--engine-text)]">
                            {copy.body}
                          </p>
                          {notification.goalTitle && !notification.moderationNote && (
                            <p className="mt-1 truncate text-xs font-semibold text-[var(--engine-text-muted)]">
                              {notification.goalTitle}
                            </p>
                          )}
                          {notification.moderationNote && (
                            <div className="mt-2 border-l-2 border-[var(--engine-accent)]/50 bg-[var(--engine-accent-soft)] px-3 py-2">
                              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--engine-accent)]">
                                Comentário do admin
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--engine-text-muted)]">
                                {notification.moderationNote}
                              </p>
                            </div>
                          )}
                          {notification.actorUsername && (
                            <p className="mt-2 truncate text-[11px] font-semibold text-[var(--engine-text-subtle)]">
                              {notification.actorUsername}
                            </p>
                          )}
                          {target && (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--engine-text-subtle)]">
                              Abrir
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--engine-border)] text-[var(--engine-text-subtle)]">
                  <Bell size={18} />
                </div>
                <p className="mt-4 text-sm font-bold text-[var(--engine-text)]">
                  {t("notifications.empty")}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--engine-text-muted)]">
                  Quando algo importante acontecer, o alerta aparece aqui.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <TopbarIconButton
        onClick={handleToggleTheme}
        title={currentTheme === "dark" ? "Modo Claro" : "Modo Escuro"}
      >
        {currentTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </TopbarIconButton>
    </div>
  );
}
