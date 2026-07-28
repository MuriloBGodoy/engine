import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Filter } from "lucide-react";
import { engineEvents } from "../services/events";
import { EventCard } from "../components/EventCard";
import { CreateEventForm } from "../components/CreateEventForm";
import { useToast } from "../components/ToastProvider";

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
    showToast("Evento criado! Confira sua criação abaixo.", "success");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Eventos de Carros 🏎️</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Encontre e participe dos melhores eventos automotivos
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-engine-accent text-white rounded-lg font-semibold hover:opacity-90 transition whitespace-nowrap"
          >
            <Plus size={20} />
            Criar Evento
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-engine-accent" />
            <h2 className="font-semibold text-lg">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tipo de Evento */}
            <div>
              <label className="block text-sm font-semibold mb-2">Tipo de Evento</label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-semibold mb-2">Estado</label>
              <select
                value={filters.state}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    state: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
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
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-engine-accent"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Carregando eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-lg">
            <p className="text-2xl mb-4">🏎️</p>
            <p className="text-lg font-semibold mb-2">Nenhum evento encontrado</p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Tente ajustar seus filtros ou crie um novo evento!
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-engine-accent text-white rounded-lg font-semibold hover:opacity-90 transition"
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
      </div>

      {/* Modal de Criação */}
      {showCreateForm && (
        <CreateEventForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
