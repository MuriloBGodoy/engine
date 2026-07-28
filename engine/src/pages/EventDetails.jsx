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
  Edit3,
} from "lucide-react";
import { auth } from "../services/firebase";
import { engineEvents } from "../services/events";
import { useToast } from "../components/ToastProvider";

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
      showToast("Você confirmou presença no evento! 🎉", "success");
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
    if (
      !window.confirm(
        "Tem certeza que deseja deletar este evento? Esta ação não pode ser desfeita."
      )
    )
      return;

    try {
      await engineEvents.deleteEvent(eventId);
      showToast("Evento deletado", "success");
      navigate("/events");
    } catch (error) {
      showToast(error.message || "Erro ao deletar evento", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-engine-accent"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">Evento não encontrado</p>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header com volta */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/events")}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold flex-1 truncate">{event.title}</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Imagem */}
        <div className="rounded-lg overflow-hidden bg-gradient-to-br from-engine-accent to-slate-300 dark:from-slate-600 dark:to-slate-700 h-96 mb-8">
          {event.image ? (
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🏎️</div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna principal */}
          <div className="lg:col-span-2">
            {/* Info rápida */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-engine-accent text-white rounded-full text-sm font-semibold">
                  {eventTypeLabel}
                </span>
                {event.isPaid && (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
                    Pago
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar size={20} className="text-engine-accent flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Data e Hora</p>
                    <p className="font-semibold capitalize">{formattedDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-engine-accent flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Local</p>
                    <p className="font-semibold">{event.location}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{event.state}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users size={20} className="text-engine-accent flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Participantes</p>
                    <p className="font-semibold">
                      {event.participantCount || 0} confirmado
                      {event.participantCount !== 1 ? "s" : ""}
                      {spotsLeft !== null && ` • ${spotsLeft} vagas restantes`}
                    </p>
                  </div>
                </div>

                {event.isPaid && (
                  <div className="flex items-start gap-3">
                    <DollarSign size={20} className="text-engine-accent flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Valor do Ingresso</p>
                      <p className="font-semibold text-lg">R$ {event.ticketPrice?.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Sobre o Evento</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {event.description || "Sem descrição disponível"}
              </p>
            </div>

            {/* Links de comunidade */}
            {(event.communityLinks?.whatsappGroup || event.communityLinks?.facebookGroup) && (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Grupos da Comunidade</h2>
                <div className="flex flex-wrap gap-3">
                  {event.communityLinks?.whatsappGroup && (
                    <a
                      href={event.communityLinks.whatsappGroup}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg font-semibold hover:bg-green-200 dark:hover:bg-green-800 transition"
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
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-800 transition"
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
          <div>
            {isOwner ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 sticky top-32 space-y-3">
                <p className="text-sm font-semibold text-engine-accent">Você é o organizador</p>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-800 transition"
                >
                  <Trash2 size={18} />
                  Deletar Evento
                </button>
              </div>
            ) : isRsvped ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 sticky top-32 space-y-4">
                <div className="p-4 bg-engine-accent bg-opacity-10 text-engine-accent rounded-lg">
                  <p className="font-semibold">✓ Você confirmou presença!</p>
                </div>
                <button
                  onClick={handleCancelRsvp}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar Presença
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 sticky top-32">
                {showRsvpForm ? (
                  <form onSubmit={handleRsvp} className="space-y-4">
                    <h3 className="font-semibold text-lg">Confirme Sua Presença</h3>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Marca do Carro</label>
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
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Modelo</label>
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
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Ano</label>
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
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRsvpForm(false)}
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={rsvpLoading}
                        className="flex-1 px-3 py-2 bg-engine-accent text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        {rsvpLoading ? "..." : "Confirmar"}
                      </button>
                    </div>
                  </form>
                ) : auth.currentUser ? (
                  <button
                    onClick={() => setShowRsvpForm(true)}
                    disabled={spotsLeft === 0}
                    className="w-full px-4 py-3 bg-engine-accent text-white rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {spotsLeft === 0 ? "Evento Lotado" : "Confirmar Presença"}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full px-4 py-3 bg-engine-accent text-white rounded-lg font-bold text-lg hover:opacity-90 transition"
                  >
                    Entrar para RSVP
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
