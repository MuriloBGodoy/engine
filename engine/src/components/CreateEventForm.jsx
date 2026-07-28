import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Upload, Loader2, AlertTriangle } from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../services/firebase";
import { useToast } from "./ToastProvider";
import { engineEvents } from "../services/events";

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] outline-none transition-colors focus:border-[var(--engine-accent)]";

const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]";

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
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "casual",
    eventDate: "",
    eventTime: "14:00",
    location: "",
    state: "SP",
    imageFile: null,
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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Por favor, selecione uma imagem válida", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Imagem muito grande (máx 5MB)", "error");
      return;
    }

    setImageLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result || "");
      };
      reader.readAsDataURL(file);

      setForm((prev) => ({
        ...prev,
        imageFile: file,
      }));
    } catch (error) {
      showToast("Erro ao processar imagem", "error");
    } finally {
      setImageLoading(false);
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
      let imageUrl = "";

      if (form.imageFile) {
        const fileName = `events/${Date.now()}-${form.imageFile.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, form.imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const eventDateTime = `${form.eventDate}T${form.eventTime}:00Z`;

      const eventData = {
        title: form.title,
        description: form.description,
        type: form.type,
        eventDate: new Date(eventDateTime).toISOString(),
        location: form.location,
        state: form.state,
        country: "BR",
        image: imageUrl,
        isPaid: form.isPaid,
        ticketPrice: form.isPaid ? Number(form.ticketPrice) : 0,
        maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : 0,
        communityLinks: {
          whatsappGroup: form.communityLinks.whatsappGroup,
          facebookGroup: form.communityLinks.facebookGroup,
        },
      };

      await engineEvents.createEvent(eventData);
      showToast("Evento criado com sucesso", "success");
      onSuccess?.();
    } catch (error) {
      showToast(error.message || "Erro ao criar evento", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--engine-bg)] rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--engine-surface)] border-b border-[var(--engine-border)] p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[var(--engine-text)]">Criar Evento</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--engine-surface-2)] rounded-lg transition"
          >
            <X size={24} className="text-[var(--engine-text)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <label className={labelClass}>Título do Evento</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="ex: 3ª Edição Cars & Coffee SP"
              className={inputClass}
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className={labelClass}>Descrição</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Descreva seu evento..."
              rows="4"
              className={inputClass}
            />
          </div>

          {/* Grid 2 colunas */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="space-y-2">
              <label className={labelClass}>Tipo</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className={inputClass}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <label className={labelClass}>Data</label>
              <input
                type="date"
                name="eventDate"
                value={form.eventDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>

            {/* Hora */}
            <div className="space-y-2">
              <label className={labelClass}>Hora</label>
              <input
                type="time"
                name="eventTime"
                value={form.eventTime}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className={labelClass}>Estado</label>
              <select
                name="state"
                value={form.state}
                onChange={handleChange}
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

          {/* Local */}
          <div className="space-y-2">
            <label className={labelClass}>Local do Evento</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="ex: Shopping Interlagos, São Paulo"
              className={inputClass}
              required
            />
          </div>

          {/* Imagem Upload */}
          <div className="space-y-2">
            <label className={labelClass}>Foto do Evento</label>
            <label className="block">
              <div className="border-2 border-dashed border-[var(--engine-border)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)] transition">
                {imageLoading ? (
                  <Loader2 size={32} className="mx-auto text-[var(--engine-accent)] animate-spin" />
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                ) : (
                  <div className="space-y-2">
                    <Upload size={32} className="mx-auto text-[var(--engine-text-muted)]" />
                    <p className="text-sm font-medium text-[var(--engine-text)]">
                      Clique ou arraste uma imagem
                    </p>
                    <p className="text-xs text-[var(--engine-text-muted)]">PNG, JPG até 5MB</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={imageLoading}
              />
            </label>
          </div>

          {/* Ingresso */}
          <div className="border border-[var(--engine-border)] rounded-xl p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isPaid"
                checked={form.isPaid}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="font-semibold text-[var(--engine-text)]">Evento com ingresso pago</span>
            </label>

            {form.isPaid && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Preço (R$)</label>
                  <input
                    type="number"
                    name="ticketPrice"
                    value={form.ticketPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Máx Participantes</label>
                  <input
                    type="number"
                    name="maxParticipants"
                    value={form.maxParticipants}
                    onChange={handleChange}
                    placeholder="Ilimitado"
                    min="0"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Links de comunidade */}
          <div className="border border-[var(--engine-border)] rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-[var(--engine-text)]">Links de Comunidade</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelClass}>Link do Grupo WhatsApp</label>
                <input
                  type="url"
                  name="communityLinks.whatsappGroup"
                  value={form.communityLinks.whatsappGroup}
                  onChange={handleChange}
                  placeholder="https://chat.whatsapp.com/..."
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Link do Grupo Facebook</label>
                <input
                  type="url"
                  name="communityLinks.facebookGroup"
                  value={form.communityLinks.facebookGroup}
                  onChange={handleChange}
                  placeholder="https://facebook.com/groups/..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-[var(--engine-border)] rounded-xl font-semibold text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || imageLoading}
              className="flex-1 px-4 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
