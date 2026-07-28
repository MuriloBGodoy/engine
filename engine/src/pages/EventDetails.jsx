import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Share2,
  MessageCircle,
  Trash2,
  Navigation,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "../services/firebase";
import { engineEvents } from "../services/events";
import { useToast } from "../components/ToastProvider";

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] outline-none transition-colors focus:border-[var(--engine-accent)]";

const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]";

export function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRsvped, setIsRsvped] = useState(false);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const [rsvpForm, setRsvpForm] = useState({
    carBrand: "",
    carModel: "",
    carYear: "",
  });

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const data = await engineEvents.getEventById(eventId);
      setEvent(data);

      if (auth.currentUser) {
        const rsvped = await engineEvents.isUserRsvped(eventId);
        setIsRsvped(rsvped);
      }
    } catch (error) {
      showToast(error.message || "Erro ao carregar evento", "error");
      navigate("/events");
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      navigate("/login");
      return;
    }

    setRsvpLoading(true);

    try {
      await engineEvents.rsvpEvent(eventId, {
        brand: rsvpForm.carBrand,
        model: rsvpForm.carModel,
        year: rsvpForm.carYear,
      });

      setIsRsvped(true);
      setShowRsvpForm(false);
      setRsvpForm({ carBrand: "", carModel: "", carYear: "" });
      showToast("Você confirmou presença no evento", "success");
      loadEvent();
    } catch (error) {
      showToast(error.message || "Erro ao confirmar presença", "error");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCancelRsvp = async () => {
    if (!window.confirm("Deseja cancelar sua presença no evento?")) return;

    try {
      await engineEvents.cancelRsvp(eventId);
      setIsRsvped(false);
      showToast("Presença cancelada", "success");
      loadEvent();
    } catch (error) {
      showToast(error.message || "Erro ao cancelar presença", "error");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja deletar este evento?")) return;

    try {
      await engineEvents.deleteEvent(eventId);
      showToast("Evento deletado", "success");
      navigate("/events");
    } catch (error) {
      showToast(error.message || "Erro ao deletar evento", "error");
    }
  };

  const openMaps = (provider) => {
    const query = encodeURIComponent(`${event.location}, ${event.state}, Brasil`);
    if (provider === "waze") {
      window.open(`https://waze.com/ul?q=${query}`, "_blank");
    } else {
      window.open(`https://maps.google.com/?q=${query}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={48} className="text-[var(--engine-accent)] animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-[var(--engine-text-muted)]">Evento não encontrado</p>
      </div>
    );
  }

  const eventDate = new Date(event.eventDate);
  const formattedDate = eventDate.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  });

  const spotsLeft = event.maxParticipants
    ? Math.max(0, event.maxParticipants - (event.participantCount || 0))
    : null;

  const isOwner = auth.currentUser?.uid === event.createdBy;

  const eventTypeLabel = {
    casual: "Casual",
    "cars-and-coffee": "Cars & Coffee",
    cruise: "Cruise",
    concours: "Concurso",
  }[event.type] || event.type;

  return (
    <div className="space-y-8">
      {/* Header com volta */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/events")}
          className="p-2 hover:bg-[var(--engine-surface-2)] rounded-lg transition text-[var(--engine-text)]"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-[var(--engine-text)] flex-1 truncate">{event.title}</h1>
      </div>

      {/* Imagem */}
      {event.image && (
        <div className="rounded-xl overflow-hidden h-80 bg-[var(--engine-surface-2)]">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info rápida */}
          <div className="engine-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-[var(--engine-accent)] text-white rounded-lg text-sm font-semibold">
                {eventTypeLabel}
              </span>
              {event.isPaid && (
                <span className="px-4 py-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold">
                  Pago
                </span>
              )}
            </div>

            <div className="space-y-3 border-t border-[var(--engine-border)] pt-4">
              <div className="flex items-start gap-3">
                <Calendar size={20} className="text-[var(--engine-accent)] flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)]">
                    Data e Hora
                  </p>
                  <p className="font-semibold text-[var(--engine-text)] capitalize">{formattedDate}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-[var(--engine-accent)] flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)]">
                    Local
                  </p>
                  <p className="font-semibold text-[var(--engine-text)]">{event.location}</p>
                  <p className="text-sm text-[var(--engine-text-muted)]">{event.state}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users size={20} className="text-[var(--engine-accent)] flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)]">
                    Participantes
                  </p>
                  <p className="font-semibold text-[var(--engine-text)]">
                    {event.participantCount || 0} confirmado
                    {event.participantCount !== 1 ? "s" : ""}
                    {spotsLeft !== null && ` • ${spotsLeft} vagas restantes`}
                  </p>
                </div>
              </div>

              {event.isPaid && (
                <div className="flex items-start gap-3">
                  <DollarSign size={20} className="text-[var(--engine-accent)] flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)]">
                      Valor do Ingresso
                    </p>
                    <p className="font-semibold text-lg text-[var(--engine-accent)]">
                      R$ {event.ticketPrice?.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          {event.description && (
            <div className="engine-card p-6 space-y-3">
              <h2 className="font-bold text-[var(--engine-text)]">Sobre o Evento</h2>
              <p className="text-[var(--engine-text-muted)] leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Localização - Mapa Links */}
          <div className="engine-card p-6 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Navigation size={20} className="text-[var(--engine-accent)]" />
              <h2 className="font-bold text-[var(--engine-text)]">Localização</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openMaps("waze")}
                className="px-4 py-3 border border-[var(--engine-border)] rounded-xl font-semibold text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] transition flex items-center justify-center gap-2"
              >
                <Navigation size={18} />
                Waze
              </button>
              <button
                onClick={() => openMaps("google")}
                className="px-4 py-3 border border-[var(--engine-border)] rounded-xl font-semibold text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] transition flex items-center justify-center gap-2"
              >
                <MapPin size={18} />
                Google Maps
              </button>
            </div>
          </div>

          {/* Links de comunidade */}
          {(event.communityLinks?.whatsappGroup || event.communityLinks?.facebookGroup) && (
            <div className="engine-card p-6 space-y-3">
              <h2 className="font-bold text-[var(--engine-text)]">Grupos da Comunidade</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                {event.communityLinks?.whatsappGroup && (
                  <a
                    href={event.communityLinks.whatsappGroup}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-semibold hover:bg-emerald-500/30 transition"
                  >
                    <MessageCircle size={20} />
                    Entrar no WhatsApp
                  </a>
                )}
                {event.communityLinks?.facebookGroup && (
                  <a
                    href={event.communityLinks.facebookGroup}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl font-semibold hover:bg-blue-500/30 transition"
                  >
                    <Share2 size={20} />
                    Entrar no Facebook
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral - RSVP */}
        <div className="space-y-6">
          {isOwner ? (
            <div className="engine-card p-6 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/30">
                <AlertTriangle size={18} className="text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  Você é o organizador
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30 rounded-xl font-semibold hover:bg-red-500/20 transition"
              >
                <Trash2 size={18} />
                Deletar Evento
              </button>
            </div>
          ) : isRsvped ? (
            <div className="engine-card p-6 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Você confirmou presença
                </p>
              </div>
              <button
                onClick={handleCancelRsvp}
                className="w-full px-4 py-3 border border-[var(--engine-border)] rounded-xl font-semibold text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] transition"
              >
                Cancelar Presença
              </button>
            </div>
          ) : (
            <div className="engine-card p-6">
              {showRsvpForm ? (
                <form onSubmit={handleRsvp} className="space-y-4">
                  <h3 className="font-bold text-[var(--engine-text)]">Confirme Sua Presença</h3>

                  <div className="space-y-2">
                    <label className={labelClass}>Marca do Carro</label>
                    <input
                      type="text"
                      value={rsvpForm.carBrand}
                      onChange={(e) =>
                        setRsvpForm((prev) => ({
                          ...prev,
                          carBrand: e.target.value,
                        }))
                      }
                      placeholder="ex: BMW"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Modelo</label>
                    <input
                      type="text"
                      value={rsvpForm.carModel}
                      onChange={(e) =>
                        setRsvpForm((prev) => ({
                          ...prev,
                          carModel: e.target.value,
                        }))
                      }
                      placeholder="ex: M4"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Ano</label>
                    <input
                      type="text"
                      value={rsvpForm.carYear}
                      onChange={(e) =>
                        setRsvpForm((prev) => ({
                          ...prev,
                          carYear: e.target.value,
                        }))
                      }
                      placeholder="ex: 2023"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRsvpForm(false)}
                      className="flex-1 px-3 py-2 border border-[var(--engine-border)] rounded-xl font-semibold text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={rsvpLoading}
                      className="flex-1 px-3 py-2 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {rsvpLoading ? "..." : "Confirmar"}
                    </button>
                  </div>
                </form>
              ) : auth.currentUser ? (
                <button
                  onClick={() => setShowRsvpForm(true)}
                  disabled={spotsLeft === 0}
                  className="w-full px-4 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {spotsLeft === 0 ? "Evento Lotado" : "Confirmar Presença"}
                </button>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="w-full px-4 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-bold text-lg hover:opacity-90 transition"
                >
                  Entrar para Confirmar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
