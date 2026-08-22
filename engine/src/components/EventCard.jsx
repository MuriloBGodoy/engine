import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { eventTypeLabel as typeLabel } from "../services/eventTypes";
import {
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Share2,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

export function EventCard({ event }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // A data seguia cravada em pt-BR: quem lia em ingles via "3 de set.".
  const locale = i18n.language || "pt-BR";

  const eventDate = new Date(event.eventDate);
  const startDateStr = eventDate.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
  const endDate = event.endDate ? new Date(event.endDate) : null;
  const endDateStr = endDate
    ? endDate.toLocaleDateString(locale, { day: "numeric", month: "short" })
    : null;
  const dateDisplay =
    endDateStr && endDateStr !== startDateStr ? `${startDateStr} - ${endDateStr}` : startDateStr;

  const eventTypeLabel = typeLabel(t, event.type);

  const spotsLeft = event.maxParticipants
    ? Math.max(0, event.maxParticipants - (event.participantCount || 0))
    : null;

  return (
    <div
      onClick={() => navigate(`/events/${event.id}`)}
      className="cursor-pointer rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)] shadow hover:shadow-lg transition overflow-hidden group"
    >
      {/* Imagem */}
      <div className="relative h-40 bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-border-strong)] overflow-hidden">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--engine-surface-2)]" />
        )}
        <div className="absolute top-3 right-3 bg-[var(--engine-accent)] text-white px-3 py-1 rounded-lg text-xs font-semibold">
          {eventTypeLabel}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-[var(--engine-text)] truncate">{event.title}</h3>
        <p className="text-sm text-[var(--engine-text-muted)] mb-3 line-clamp-2">
          {event.description}
        </p>

        {/* Detalhes */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
            <Calendar size={16} className="text-[var(--engine-accent)]" />
            <span>
              {dateDisplay}
              {event.startTime && ` • ${event.startTime}`}
              {event.endTime && ` - ${event.endTime}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
            <MapPin size={16} className="text-[var(--engine-accent)]" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
            <Users size={16} className="text-[var(--engine-accent)]" />
            <span>
              {event.participantCount || 0} confirmado
              {event.participantCount !== 1 ? "s" : ""}
              {spotsLeft !== null && ` • ${spotsLeft} vagas`}
            </span>
          </div>

          {event.isPaid && (
            <div className="flex items-center gap-2 text-[var(--engine-accent)] font-semibold">
              <DollarSign size={16} />
              <span>R$ {event.ticketPrice?.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Links de comunidade */}
        {(event.communityLinks?.whatsappGroup || event.communityLinks?.facebookGroup) && (
          <div className="flex gap-2 pt-3 border-t border-[var(--engine-border)]">
            {event.communityLinks?.whatsappGroup && (
              <a
                href={event.communityLinks.whatsappGroup}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition"
                title={t("events.links.whatsappTitle")}
              >
                <MessageCircle size={14} />
                {t("events.links.whatsapp")}
              </a>
            )}
            {event.communityLinks?.facebookGroup && (
              <a
                href={event.communityLinks.facebookGroup}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition"
                title={t("events.links.facebookTitle")}
              >
                <Share2 size={14} />
                {t("events.links.facebook")}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
