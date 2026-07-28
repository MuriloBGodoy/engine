import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Filter, Loader2 } from "lucide-react";
import { engineEvents } from "../services/events";
import { EventCard } from "../components/EventCard";
import { CreateEventForm } from "../components/CreateEventForm";
import { useToast } from "../components/ToastProvider";

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] outline-none transition-colors focus:border-[var(--engine-accent)]";

const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]";

const EVENT_TYPES = [
  { value: "all", label: "Todos" },
  { value: "casual", label: "Casual" },
  { value: "cars-and-coffee", label: "Cars & Coffee" },
  { value: "cruise", label: "Cruise" },
  { value: "concours", label: "Concurso" },
];

const STATES = [
  "Todos",
  "SP", "RJ", "MG", "BA", "RS", "PE", "CE", "PA", "SC", "GO",
  "PB", "MA", "ES", "PI", "RN", "AL", "MT", "MS", "DF", "AC",
  "AM", "AP", "RO", "RR", "TO",
];

export function Events() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    state: "Todos",
  });

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const filterParams = {
        type: filters.type === "all" ? null : filters.type,
        state: filters.state === "Todos" ? null : filters.state,
        limit: 50,
      };

      const result = await engineEvents.getUpcomingEvents(filterParams);
      setEvents(result);
    } catch (error) {
      showToast(error.message || "Erro ao carregar eventos", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadEvents();
    showToast("Evento criado com sucesso", "success");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[var(--engine-text)]">Eventos</h1>
            <p className="text-[var(--engine-text-muted)] mt-2">
              Encontre e participe de eventos automotivos
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition whitespace-nowrap"
          >
            <Plus size={20} />
            Criar Evento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="engine-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={20} className="text-[var(--engine-accent)]" />
          <h2 className="font-semibold text-[var(--engine-text)]">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Tipo de Evento */}
          <div className="space-y-2">
            <label className={labelClass}>Tipo de Evento</label>
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value,
                }))
              }
              className={inputClass}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <label className={labelClass}>Estado</label>
            <select
              value={filters.state}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  state: e.target.value,
                }))
              }
              className={inputClass}
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Eventos */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 size={48} className="mx-auto text-[var(--engine-accent)] animate-spin mb-4" />
          <p className="text-[var(--engine-text-muted)]">Carregando eventos...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 engine-card p-8">
          <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
            Nenhum evento encontrado
          </p>
          <p className="text-[var(--engine-text-muted)] mb-6">
            Tente ajustar seus filtros ou crie um novo evento
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition"
          >
            <Plus size={20} />
            Criar Evento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {showCreateForm && (
        <CreateEventForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
