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

/**
 * Rótulos, ícones e textos das notificações — fora do componente para que o
 * arquivo do painel exporte só o componente (regra do fast refresh).
 */
const notificationLabels = {
  follow: "Novo seguidor",
  like: "Curtida",
  comment: "Comentário",
  rating: "Avaliação",
  service_approved: "Anúncio aprovado",
  service_changes_requested: "Anúncio retornado",
  service_rejected: "Anúncio recusado",
};

export const notificationStyles = {
  follow: { icon: UserPlus, iconClass: "text-sky-500" },
  like: { icon: Heart, iconClass: "text-red-500" },
  comment: { icon: MessageCircle, iconClass: "text-violet-500" },
  rating: { icon: Star, iconClass: "text-amber-500" },
  service_approved: { icon: CheckCircle2, iconClass: "text-emerald-500" },
  service_changes_requested: { icon: RotateCcw, iconClass: "text-sky-500" },
  service_rejected: { icon: XCircle, iconClass: "text-red-500" },
};

export const defaultNotificationStyle = {
  icon: Bell,
  iconClass: "text-slate-500",
};

export const formatNotificationTime = (createdAt) => {
  const date = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!date || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const getNotificationTarget = (notification) => {
  if (notification.targetPath) return notification.targetPath;
  if (notification.goalId)
    return `/community?goal=${encodeURIComponent(notification.goalId)}`;
  if (notification.serviceId) return "/services";
  if (["follow", "like", "comment", "rating"].includes(notification.type)) {
    return "/community";
  }
  return "";
};

export const getNotificationCopy = (notification) => {
  if (notification.notificationTitle || notification.notificationBody) {
    return {
      title:
        notification.notificationTitle ||
        notificationLabels[notification.type] ||
        "Notificação",
      body: notification.notificationBody || "",
    };
  }

  const actor = notification.actorName || "Alguém";
  const byType = {
    service_approved: {
      title: "Anúncio aprovado",
      body: "Seu anúncio foi publicado.",
    },
    service_changes_requested: {
      title: "Alterações solicitadas",
      body: "Revise os comentários do admin.",
    },
    service_rejected: {
      title: "Anúncio recusado",
      body: "Confira o motivo enviado.",
    },
    like: { title: "Nova curtida", body: `${actor} curtiu sua publicação.` },
    comment: {
      title: "Novo comentário",
      body: `${actor} comentou na sua publicação.`,
    },
    rating: {
      title: "Nova avaliação",
      body: `${actor} avaliou sua publicação.`,
    },
    follow: { title: "Novo seguidor", body: `${actor} começou a seguir você.` },
  };

  return (
    byType[notification.type] || {
      title: notificationLabels[notification.type] || "Notificação",
      body: notification.text || "",
    }
  );
};
