import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Upload } from "lucide-react";
import { useToast } from "./ToastProvider";
import { engineEvents } from "../services/events";

const EVENT_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "cars-and-coffee", label: "Cars & Coffee" },
  { value: "cruise", label: "Cruise" },
  { value: "concours", label: "Concurso" },
];

const STATES = [
  "SP", "RJ", "MG", "BA", "RS", "PE", "CE", "PA", "SC", "GO",
  "PB", "MA", "ES", "PI", "RN", "AL", "MT", "MS", "DF", "AC",
  "AM", "AP", "RO", "RR", "TO",
];

export function CreateEventForm({ onSuccess, onCancel }) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "casual",
    eventDate: "",
    eventTime: "14:00",
    location: "",
    state: "SP",
    image: "",
    isPaid: false,
    ticketPrice: "",
    maxParticipants: "",
    communityLinks: {
      whatsappGroup: "",
      facebookGroup: "",
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes("communityLinks.")) {
      const key = name.split(".")[1];
      setForm((prev) => ({
        ...prev,
        communityLinks: {
          ...prev.communityLinks,
          [key]: value,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      showToast("Título do evento é obrigatório", "error");
      return;
    }

    if (!form.eventDate) {
      showToast("Data do evento é obrigatória", "error");
      return;
    }

    if (!form.location.trim()) {
      showToast("Local do evento é obrigatório", "error");
      return;
    }

    if (form.isPaid && (!form.ticketPrice || Number(form.ticketPrice) <= 0)) {
      showToast("Preço do ingresso deve ser maior que zero", "error");
      return;
    }

    setLoading(true);

    try {
      const eventDateTime = `${form.eventDate}T${form.eventTime}:00Z`;

      const eventData = {
        title: form.title,
        description: form.description,
        type: form.type,
        eventDate: new Date(eventDateTime).toISOString(),
        location: form.location,
        state: form.state,
        country: "BR",
        image: form.image,
        isPaid: form.isPaid,
        ticketPrice: form.isPaid ? Number(form.ticketPrice) : 0,
        maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : 0,
        communityLinks: {
          whatsappGroup: form.communityLinks.whatsappGroup,
          facebookGroup: form.communityLinks.facebookGroup,
        },
      };

      await engineEvents.createEvent(eventData);
      showToast("Evento criado com sucesso! 🎉", "success");
      onSuccess?.();
    } catch (error) {
      showToast(error.message || "Erro ao criar evento", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Criar Evento</h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Título do Evento *
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="ex: 3ª Edição Cars & Coffee SP"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold mb-2">Descrição</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Descreva seu evento..."
              rows="4"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
            />
          </div>

          {/* Grid 2 colunas */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-semibold mb-2">Tipo</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Data *
              </label>
              <input
                type="date"
                name="eventDate"
                value={form.eventDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                required
              />
            </div>

            {/* Hora */}
            <div>
              <label className="block text-sm font-semibold mb-2">Hora</label>
              <input
                type="time"
                name="eventTime"
                value={form.eventTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-semibold mb-2">Estado</label>
              <select
                name="state"
                value={form.state}
                onChange={handleChange}
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

          {/* Local */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Local do Evento *
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="ex: Shopping Interlagos, São Paulo"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
              required
            />
          </div>

          {/* Imagem */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              URL da Imagem
            </label>
            <input
              type="url"
              name="image"
              value={form.image}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
            />
            {form.image && (
              <img
                src={form.image}
                alt="Preview"
                className="w-full h-32 object-cover rounded mt-2"
              />
            )}
          </div>

          {/* Ingresso */}
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="isPaid"
                name="isPaid"
                checked={form.isPaid}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="isPaid" className="text-sm font-semibold cursor-pointer">
                Evento com ingresso pago
              </label>
            </div>

            {form.isPaid && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    name="ticketPrice"
                    value={form.ticketPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Máx de Participantes
                  </label>
                  <input
                    type="number"
                    name="maxParticipants"
                    value={form.maxParticipants}
                    onChange={handleChange}
                    placeholder="Ilimitado"
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Links de comunidade */}
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4">
            <h3 className="font-semibold mb-4">Links de Comunidade</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Link do Grupo WhatsApp
                </label>
                <input
                  type="url"
                  name="communityLinks.whatsappGroup"
                  value={form.communityLinks.whatsappGroup}
                  onChange={handleChange}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Link do Grupo Facebook
                </label>
                <input
                  type="url"
                  name="communityLinks.facebookGroup"
                  value={form.communityLinks.facebookGroup}
                  onChange={handleChange}
                  placeholder="https://facebook.com/groups/..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-black dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-engine-accent text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
