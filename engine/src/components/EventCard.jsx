import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Share2,
  MessageCircle,
} from "lucide-react";

export function EventCard({ event }) {
  const navigate = useNavigate();

  const eventDate = new Date(event.eventDate);
  const formattedDate = eventDate.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const eventTypeLabel = {
    casual: "Casual",
    "cars-and-coffee": "Cars & Coffee",
    cruise: "Cruise",
    concours: "Concurso",
  }[event.type] || event.type;

  const spotsLeft = event.maxParticipants
    ? Math.max(0, event.maxParticipants - (event.participantCount || 0))
    : null;

  return (
    <div
      onClick={() => navigate(`/events/${event.id}`)}
      className="cursor-pointer rounded-lg bg-white dark:bg-slate-800 shadow hover:shadow-lg transition overflow-hidden group"
    >
      {/* Imagem */}
      <div className="relative h-40 bg-gradient-to-br from-engine-accent to-slate-300 dark:from-slate-600 dark:to-slate-700 overflow-hidden">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏎️</div>
        )}
        <div className="absolute top-2 right-2 bg-engine-accent text-white px-2 py-1 rounded text-xs font-semibold">
          {eventTypeLabel}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        <h3 className="font-semibold text-lg truncate">{event.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {event.description}
        </p>

        {/* Detalhes */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Calendar size={16} className="text-engine-accent" />
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <MapPin size={16} className="text-engine-accent" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Users size={16} className="text-engine-accent" />
            <span>
              {event.participantCount || 0} participante
              {event.participantCount !== 1 ? "s" : ""}
              {spotsLeft !== null && ` • ${spotsLeft} vagas`}
            </span>
          </div>

          {event.isPaid && (
            <div className="flex items-center gap-2 text-engine-accent font-semibold">
              <DollarSign size={16} />
              <span>R$ {event.ticketPrice?.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Links de comunidade */}
        {(event.communityLinks?.whatsappGroup || event.communityLinks?.facebookGroup) && (
          <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            {event.communityLinks?.whatsappGroup && (
              <a
                href={event.communityLinks.whatsappGroup}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium hover:bg-green-200 dark:hover:bg-green-800 transition"
                title="Grupo do WhatsApp"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            )}
            {event.communityLinks?.facebookGroup && (
              <a
                href={event.communityLinks.facebookGroup}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                title="Grupo do Facebook"
              >
                <Share2 size={14} />
                Facebook
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
