import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ImagePlus, Plus, Wrench, ExternalLink } from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../services/firebase";
import { auth } from "../services/firebase";
import { useToast } from "./ToastProvider";
import { engineEvents } from "../services/events";
import { countries, getStates, getCities } from "../services/locations";

const mapQuery = (event) =>
  [event.address, event.city].filter(Boolean).join(",");

const hasMapAddress = (event) => Boolean(mapQuery(event));

const getMapUrl = (event) =>
  `https://www.google.com/maps?q=${encodeURIComponent(mapQuery(event))}&output=embed`;

const getDirectionsUrl = (event) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(event))}`;

const MAX_PHOTOS = 4;

function Field({ label, children, wide = false }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)] mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="min-h-12 w-full min-w-0 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 text-sm font-bold text-[var(--engine-text)] outline-none transition placeholder:text-[var(--engine-text-subtle)] focus:border-[var(--engine-accent)] focus:bg-[var(--engine-surface)] dark:text-white dark:[color-scheme:dark] dark:placeholder:text-[var(--engine-text-muted)] dark:focus:bg-[var(--engine-elevated)]"
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="min-h-32 w-full resize-none rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-sm font-bold leading-6 text-[var(--engine-text)] outline-none transition placeholder:text-[var(--engine-text-subtle)] focus:border-[var(--engine-accent)] focus:bg-[var(--engine-surface)] dark:text-white dark:[color-scheme:dark] dark:placeholder:text-[var(--engine-text-muted)] dark:focus:bg-[var(--engine-elevated)]"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="min-h-12 w-full appearance-none rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 pr-9 text-sm font-bold text-[var(--engine-text)] outline-none transition focus:border-[var(--engine-accent)] focus:bg-[var(--engine-surface)] dark:text-white dark:[color-scheme:dark] dark:focus:bg-[var(--engine-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function getInitials(name = "U") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function MapPreview({ event, compact = false }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)]">
      <iframe
        title={`Mapa de ${event.city}`}
        src={getMapUrl(event)}
        loading="lazy"
        className={`${compact ? "h-44" : "h-64"} w-full border-0`}
      />
      <a
        href={getDirectionsUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 border-t border-[var(--engine-border)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-accent)] transition hover:bg-[var(--engine-accent)] hover:text-white"
      >
        <ExternalLink size={15} />
        Abrir no Google Maps
      </a>
    </div>
  );
}

const EVENT_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "cars-and-coffee", label: "Cars & Coffee" },
  { value: "cruise", label: "Cruise" },
  { value: "concours", label: "Concurso" },
  { value: "drift", label: "Drift" },
  { value: "track-day", label: "Track Day" },
  { value: "auto-meet", label: "Auto Meet" },
  { value: "autocross", label: "Autocross" },
  { value: "drag-racing", label: "Drag Racing" },
  { value: "rallye", label: "Rallye" },
];

export function CreateEventForm({ onSuccess, onCancel }) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "casual",
    eventDate: "",
    endDate: "",
    startTime: "14:00",
    endTime: "",
    country: "BR",
    state: "",
    city: "",
    address: "",
    photos: [],
    maxParticipants: "",
    communityLinks: {
      whatsappGroup: "",
      facebookGroup: "",
    },
  });

  const formStates = getStates(form.country);
  const formCities = getCities(form.country, form.state);
  const cityListId = "event-city-suggestions";
  const sellerProfile = {
    displayName: auth.currentUser?.displayName || "Você",
    avatar: auth.currentUser?.photoURL || "",
  };

  const handleChange = (key, value) => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      setForm((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setPhotoUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (form.photos.length >= MAX_PHOTOS) break;
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) {
          showToast(`${file.name} é muito grande (máx 5MB)`, "error");
          continue;
        }

        const fileName = `events/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        setForm((prev) => ({
          ...prev,
          photos: [...prev.photos, url],
        }));
      }
    } catch (error) {
      showToast("Erro ao fazer upload de fotos", "error");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRemove = (photo) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p !== photo),
    }));
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

    if (!form.state || !form.city) {
      showToast("Selecione estado e cidade", "error");
      return;
    }

    setSaving(true);

    try {
      const eventDateTime = `${form.eventDate}T${form.startTime}:00Z`;

      const location = form.address
        ? `${form.address}, ${form.city}`
        : form.city;

      const eventData = {
        title: form.title,
        description: form.description,
        type: form.type,
        eventDate: new Date(eventDateTime).toISOString(),
        endDate: form.endDate || "",
        startTime: form.startTime,
        endTime: form.endTime,
        location: location,
        state: form.state,
        country: form.country,
        image: form.photos[0] || "",
        isPaid: false,
        ticketPrice: 0,
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
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="min-h-[100dvh] w-full max-w-5xl rounded-none border-0 border-[var(--engine-border)] bg-[var(--engine-surface)] shadow-2xl sm:my-4 sm:min-h-0 sm:rounded-2xl sm:border"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--engine-border)] bg-[var(--engine-surface)] p-4 sm:gap-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--engine-accent)]">
              Novo Evento
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[var(--engine-text)] dark:text-white sm:text-xl">
              Cadastrar Evento
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--engine-text-muted)]">
              Compartilhe seu evento com a comunidade automotiva
            </p>
            <div className="mt-4 flex max-w-xl items-center gap-3 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--engine-accent)] text-sm font-bold uppercase text-white">
                {sellerProfile?.avatar ? (
                  <img src={sellerProfile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(sellerProfile?.displayName)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  Publicado como
                </p>
                <p className="truncate text-sm font-bold italic text-[var(--engine-text)] dark:text-white">
                  {sellerProfile?.displayName}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-accent)] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <div className="grid gap-5 p-4 pb-28 sm:p-6 md:grid-cols-2">
          {/* Fotos */}
          <Field label="Fotos do Evento" wide>
            <div className="grid gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {form.photos.map((photo) => (
                <div key={photo} className="relative overflow-hidden rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)]">
                  <img src={photo} alt="" className="h-36 w-full object-cover sm:h-32" />
                  <button
                    type="button"
                    onClick={() => handlePhotoRemove(photo)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-[var(--engine-accent)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {form.photos.length < MAX_PHOTOS && (
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-4 text-center transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]">
                  {photoUploading ? (
                    <Wrench className="mb-2 animate-spin text-[var(--engine-accent)]" size={24} />
                  ) : (
                    <ImagePlus className="mb-2 text-[var(--engine-accent)]" size={24} />
                  )}
                  <span className="text-xs font-black uppercase tracking-widest">
                    {photoUploading ? "Enviando..." : "Adicionar Foto"}
                  </span>
                  <span className="mt-1 text-[11px] font-bold text-[var(--engine-text-subtle)]">
                    Máx {MAX_PHOTOS} imagens
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={photoUploading}
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>
          </Field>

          {/* Título */}
          <Field label="Título do Evento" wide>
            <TextInput
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="ex: 3ª Edição Cars & Coffee SP"
            />
          </Field>

          {/* Tipo + Data + Hora */}
          <Field label="Tipo">
            <Select
              value={form.type}
              onChange={(e) => handleChange("type", e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data de Início">
            <TextInput
              type="date"
              value={form.eventDate}
              onChange={(e) => handleChange("eventDate", e.target.value)}
            />
          </Field>

          <Field label="Data de Término (Opcional)">
            <TextInput
              type="date"
              value={form.endDate}
              onChange={(e) => handleChange("endDate", e.target.value)}
              placeholder="Se for dia diferente"
            />
          </Field>

          <Field label="Hora de Início">
            <TextInput
              type="time"
              value={form.startTime}
              onChange={(e) => handleChange("startTime", e.target.value)}
            />
          </Field>

          <Field label="Hora de Término (Opcional)">
            <TextInput
              type="time"
              value={form.endTime}
              onChange={(e) => handleChange("endTime", e.target.value)}
              placeholder="Deixe em branco se não souber"
            />
          </Field>

          {/* Descrição */}
          <Field label="Descrição" wide>
            <TextArea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descreva seu evento..."
            />
          </Field>

          {/* Localização */}
          <Field label="País">
            <Select
              value={form.country || "BR"}
              onChange={(e) => {
                handleChange("country", e.target.value);
                handleChange("state", "");
                handleChange("city", "");
              }}
            >
              {countries.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.flag} {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Estado">
            <Select
              value={form.state || ""}
              onChange={(e) => {
                handleChange("state", e.target.value);
                handleChange("city", "");
              }}
              disabled={!formStates.length}
            >
              <option value="">
                {formStates.length ? "Selecione..." : "Não disponível"}
              </option>
              {formStates.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cidade">
            <TextInput
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="ex: São Paulo"
              list={formCities.length ? cityListId : undefined}
            />
            {formCities.length > 0 && (
              <datalist id={cityListId}>
                {formCities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            )}
          </Field>

          <Field label="Endereço (Opcional)">
            <TextInput
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="ex: Rua das Flores, 123"
            />
          </Field>

          {/* Preview do Mapa */}
          {hasMapAddress(form) && (
            <div className="md:col-span-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[var(--engine-text-muted)]">
                Visualização do Mapa
              </p>
              <MapPreview event={form} />
            </div>
          )}

          {/* Máx Participantes */}
          <Field label="Máx Participantes">
            <TextInput
              type="number"
              value={form.maxParticipants}
              onChange={(e) => handleChange("maxParticipants", e.target.value)}
              placeholder="0 = Ilimitado"
              min="0"
            />
          </Field>

          {/* Links de Comunidade */}
          <Field label="Grupo WhatsApp">
            <TextInput
              type="url"
              value={form.communityLinks.whatsappGroup}
              onChange={(e) => handleChange("communityLinks.whatsappGroup", e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
            />
          </Field>

          <Field label="Grupo Facebook">
            <TextInput
              type="url"
              value={form.communityLinks.facebookGroup}
              onChange={(e) => handleChange("communityLinks.facebookGroup", e.target.value)}
              placeholder="https://facebook.com/groups/..."
            />
          </Field>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-col gap-3 border-t border-[var(--engine-border)] p-5 sm:flex-row sm:p-6">
          <button
            type="submit"
            disabled={saving || photoUploading}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-5 text-sm font-bold uppercase text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Wrench className="animate-spin" size={18} /> : <Plus size={18} />}
            {saving ? "Criando..." : "Criar Evento"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--engine-border)] px-5 text-sm font-black uppercase tracking-widest text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
