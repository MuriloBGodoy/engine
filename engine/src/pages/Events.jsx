import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Filter, Loader2 } from "lucide-react";
import { engineEvents } from "../services/events";
import { EventCard } from "../components/EventCard";
import { CreateEventForm } from "../components/CreateEventForm";
import { useToast } from "../components/ToastProvider";
import { getStates } from "../services/locations";
import { eventTypeOptions } from "../services/eventTypes";

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] outline-none transition-colors focus:border-[var(--engine-accent)]";

const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]";



/**
 * `embedded` — a mesma tela servida como aba de Comunidade (?tab=eventos). Lá a
 * barra de abas já diz onde a pessoa está, então o título e o subtítulo daqui
 * seriam eco; sobra só o botão de criar. A rota /events segue usando a forma
 * completa.
 */
export function Events({ embedded = false }) {
  const { t } = useTranslation();
  const showToast = useToast();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    state: "all",
  });

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const filterParams = {
        type: filters.type === "all" ? null : filters.type,
        state: filters.state === "all" ? null : filters.state,
        limit: 50,
      };

      const result = await engineEvents.getUpcomingEvents(filterParams);
      setEvents(result);
    } catch (error) {
      showToast(error.message || t("events.toast.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadEvents();
    showToast(t("events.toast.created"), "success");
  };

  return (
    <div className={embedded ? "space-y-5" : "space-y-8"}>
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {!embedded && (
            <div>
              <h1 className="text-3xl font-bold text-[var(--engine-text)] sm:text-4xl">
                {t("events.title")}
              </h1>
              <p className="text-[var(--engine-text-muted)] mt-2">
                {t("events.subtitle")}
              </p>
            </div>
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-6 py-3 font-semibold text-white transition hover:opacity-90 ${
              embedded ? "w-full sm:w-auto" : "whitespace-nowrap"
            }`}
          >
            <Plus size={20} />
            {t("events.create")}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="engine-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={20} className="text-[var(--engine-accent)]" />
          <h2 className="font-semibold text-[var(--engine-text)]">{t("events.filters.title")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Tipo de Evento */}
          <div className="space-y-2">
            <label className={labelClass}>{t("events.filters.type")}</label>
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
              {eventTypeOptions(t, { withAll: true }).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <label className={labelClass}>{t("events.filters.state")}</label>
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
              <option value="all">{t("events.filters.all")}</option>
              {getStates("BR").map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
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
          <p className="text-[var(--engine-text-muted)]">{t("events.loading")}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 engine-card p-8">
          <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
            {t("events.emptyTitle")}
          </p>
          <p className="text-[var(--engine-text-muted)] mb-6">
            {t("events.emptyCopy")}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition"
          >
            <Plus size={20} />
            {t("events.create")}
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
