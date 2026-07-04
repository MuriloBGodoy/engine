import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Filter,
  ImagePlus,
  LockKeyhole,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserRoundCheck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { engineDB } from "../services/db";
import { storage } from "../services/firebase";

const SUBSCRIPTION_GATE_OPEN = true;
const MAX_PHOTOS = 6;
const PHOTO_UPLOAD_TIMEOUT_MS = 15000;
const FALLBACK_IMAGE_MAX_SIZE = 1100;
const FALLBACK_IMAGE_QUALITY = 0.72;
const SERVICE_ADMIN_EMAILS = (
  import.meta.env.VITE_SERVICE_ADMIN_EMAILS || "muxdtuber@gmail.com"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const categories = [
  "Estética automotiva",
  "Limpeza de carros",
  "Mecânica",
  "Funilaria e pintura",
  "Elétrica",
  "Pneus e rodas",
  "Guincho",
  "Som e acessórios",
  "Vistoria",
  "Consultoria",
  "Outro",
];

const emptyForm = {
  id: "",
  title: "",
  providerName: "",
  category: "Limpeza de carros",
  description: "",
  price: "",
  serviceMode: "hybrid",
  city: "",
  address: "",
  serviceArea: "",
  whatsappCountry: "+55",
  whatsapp: "",
  email: "",
  website: "",
  availability: "",
  experience: "",
  tags: "",
  photos: [],
  moderationStatus: "pending",
};

const modeLabels = {
  place: "Local físico",
  mobile: "Vou até você",
  hybrid: "Local e atendimento externo",
};

const modeIcons = {
  place: Store,
  mobile: Navigation,
  hybrid: BriefcaseBusiness,
};

const modeCopy = {
  place: "Endereço obrigatório e mapa visível no anúncio.",
  mobile: "Área atendida em destaque, sem exigir endereço fixo.",
  hybrid: "Mostra mapa do local e também a região de deslocamento.",
};

const statusLabels = {
  approved: "Aprovado",
  pending: "Em análise",
  rejected: "Ajustes necessários",
};

const fallbackPhoto =
  "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1100&q=80";

const getInitials = (name = "S") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const normalizeWhatsApp = (value = "") => value.replace(/\D/g, "");

const phoneCountries = [
  { code: "+55", label: "BR" },
  { code: "+1", label: "US/CA" },
  { code: "+351", label: "PT" },
  { code: "+34", label: "ES" },
  { code: "+44", label: "UK" },
  { code: "+33", label: "FR" },
  { code: "+49", label: "DE" },
  { code: "+39", label: "IT" },
  { code: "+52", label: "MX" },
  { code: "+54", label: "AR" },
  { code: "+56", label: "CL" },
  { code: "+57", label: "CO" },
];

const inferPhoneCountry = (value = "") => {
  const cleanValue = String(value).replace(/\s/g, "");
  return (
    phoneCountries
      .map((country) => country.code)
      .sort((a, b) => b.length - a.length)
      .find((code) => cleanValue.startsWith(code)) || "+55"
  );
};

const stripPhoneCountry = (value = "", countryCode = "+55") => {
  const cleanCountry = countryCode.replace(/\D/g, "");
  const digits = String(value).replace(/\D/g, "");
  return digits.startsWith(cleanCountry) ? digits.slice(cleanCountry.length) : digits;
};

const formatPhoneInput = (value = "", countryCode = "+55") => {
  const digits = String(value).replace(/\D/g, "").slice(0, 14);

  if (countryCode === "+55") {
    const localDigits = stripPhoneCountry(digits, countryCode).slice(0, 11);
    const areaCode = localDigits.slice(0, 2);
    const firstPart = localDigits.length > 10
      ? localDigits.slice(2, 7)
      : localDigits.slice(2, 6);
    const secondPart = localDigits.length > 10
      ? localDigits.slice(7, 11)
      : localDigits.slice(6, 10);

    let formatted = "";
    if (areaCode) formatted += `(${areaCode}`;
    if (areaCode.length === 2) formatted += ") ";
    if (firstPart) formatted += firstPart;
    if (secondPart) formatted += `-${secondPart}`;
    return formatted;
  }

  if (countryCode === "+1") {
    const localDigits = stripPhoneCountry(digits, countryCode).slice(0, 10);
    const areaCode = localDigits.slice(0, 3);
    const firstPart = localDigits.slice(3, 6);
    const secondPart = localDigits.slice(6, 10);

    let formatted = "";
    if (areaCode) formatted += `(${areaCode}`;
    if (areaCode.length === 3) formatted += ") ";
    if (firstPart) formatted += firstPart;
    if (secondPart) formatted += `-${secondPart}`;
    return formatted;
  }

  return stripPhoneCountry(digits, countryCode)
    .replace(/(\d{3})(?=\d)/g, "$1 ")
    .trim();
};

const splitStoredPhone = (value = "", fallbackCountry = "+55") => {
  const cleanValue = String(value || "").trim();
  const countryCode = cleanValue.startsWith("+")
    ? inferPhoneCountry(cleanValue)
    : fallbackCountry;
  return {
    whatsappCountry: countryCode,
    whatsapp: formatPhoneInput(stripPhoneCountry(value, countryCode), countryCode),
  };
};

const formatCurrencyInput = (value = "") => {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
};

const withUploadTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(
        () => reject(new Error(`${label} demorou demais para responder.`)),
        PHOTO_UPLOAD_TIMEOUT_MS,
      );
    }),
  ]);

const compressImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.onload = () => {
        const scale = Math.min(
          1,
          FALLBACK_IMAGE_MAX_SIZE / Math.max(image.width, image.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", FALLBACK_IMAGE_QUALITY));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const mapQuery = (listing) =>
  [listing.address, listing.city].filter(Boolean).join(", ");

const hasMapAddress = (listing) => Boolean(mapQuery(listing));

const getMapUrl = (listing) =>
  `https://www.google.com/maps?q=${encodeURIComponent(mapQuery(listing))}&output=embed`;

const getDirectionsUrl = (listing) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(listing))}`;

const makeInitialForm = (settings, user) => ({
  ...emptyForm,
  providerName: settings?.profile?.displayName || user?.displayName || "",
  city: settings?.profile?.location || "",
  ...splitStoredPhone(settings?.profile?.phone || ""),
  email: user?.email || "",
});

function Field({ label, children, wide = false }) {
  return (
    <label className={`grid min-w-0 gap-2 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="min-h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:bg-white dark:border-[#333] dark:bg-[#101010] dark:text-white dark:[color-scheme:dark] dark:placeholder:text-gray-600 dark:focus:bg-[#151515]"
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="min-h-32 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold leading-6 text-slate-950 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:bg-white dark:border-[#333] dark:bg-[#101010] dark:text-white dark:[color-scheme:dark] dark:placeholder:text-gray-600 dark:focus:bg-[#151515]"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="min-h-12 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 pr-9 text-sm font-bold text-slate-950 outline-none transition focus:border-red-500 focus:bg-white dark:border-[#333] dark:bg-[#101010] dark:text-white dark:[color-scheme:dark] dark:focus:bg-[#151515]"
    />
  );
}

function StatusBadge({ status }) {
  const styles = {
    approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    pending: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    rejected: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
        styles[status] || styles.pending
      }`}
    >
      {status === "approved" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {statusLabels[status] || statusLabels.pending}
    </span>
  );
}

function ServiceCard({ listing, isMine, onEdit, onDelete }) {
  const ModeIcon = modeIcons[listing.serviceMode] || BriefcaseBusiness;
  const phone = normalizeWhatsApp(listing.whatsapp);
  const photos = listing.photos?.length ? listing.photos : [fallbackPhoto];
  const showMap = hasMapAddress(listing);

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition hover:-translate-y-0.5 hover:border-red-500/40 dark:border-[#222] dark:bg-[#151515] dark:shadow-none">
      <div className="relative h-56 bg-gray-100 sm:h-72 dark:bg-[#101010]">
        <img
          src={photos[0]}
          alt={listing.title}
          onError={(event) => {
            event.currentTarget.src = fallbackPhoto;
          }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 text-white">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {listing.category}
            </span>
            {isMine && <StatusBadge status={listing.moderationStatus} />}
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tight">
            {listing.title}
          </h2>
        </div>
        {photos.length > 1 && (
          <div className="absolute right-4 top-4 rounded-full bg-black/65 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
            {photos.length} fotos
          </div>
        )}
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black italic text-white dark:bg-red-600">
                {getInitials(listing.providerName || listing.title)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
                  {listing.providerName || "Profissional Engine"}
                </p>
                <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-gray-400">
                  {listing.city || "Online"} / {listing.serviceArea || modeLabels[listing.serviceMode]}
                </p>
              </div>
            </div>
            {isMine && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(listing)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010]"
                  title="Editar anúncio"
                >
                  <Edit3 size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(listing)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010]"
                  title="Excluir anúncio"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="hide-scrollbar flex gap-2 overflow-x-auto">
              {photos.slice(1).map((photo) => (
                <img
                  key={photo}
                  src={photo}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          <p className="text-sm font-medium leading-7 text-gray-600 dark:text-gray-300">
            {listing.description}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoPill icon={ModeIcon} label="Atendimento" value={modeLabels[listing.serviceMode]} tone="red" />
            <InfoPill icon={Clock} label="Agenda" value={listing.availability || "A combinar"} tone="amber" />
            <InfoPill icon={ShieldCheck} label="Status" value={statusLabels[listing.moderationStatus]} tone="emerald" />
          </div>

          <div className="flex flex-wrap gap-2">
            {(listing.tags || []).map((tag) => (
              <span
                key={`${listing.id}-${tag}`}
                className="rounded-full border border-gray-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:border-[#333] dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ContactButton
              disabled={!phone}
              href={phone ? `https://wa.me/${phone}` : undefined}
              icon={Phone}
              label="Chamar no WhatsApp"
              value={listing.whatsapp || "Sem número"}
            />
            <ContactButton
              disabled={!listing.email}
              href={listing.email ? `mailto:${listing.email}?subject=${encodeURIComponent(`Contato pelo Engine: ${listing.title}`)}` : undefined}
              icon={Mail}
              label="Enviar e-mail"
              value={listing.email || "Sem e-mail"}
            />
          </div>
        </div>

        <aside className="grid gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#262626] dark:bg-[#101010]">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Localização e preço
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-black text-slate-950 dark:text-white">
              <MapPin className="mt-0.5 shrink-0 text-red-500" size={17} />
              <span>{mapQuery(listing) || listing.serviceArea || "Atendimento remoto ou a combinar"}</span>
            </p>
            <p className="mt-3 text-2xl font-black italic text-red-600">
              {listing.price || "Orçamento sob consulta"}
            </p>
            {listing.experience && (
              <p className="mt-2 text-xs font-bold leading-5 text-gray-500 dark:text-gray-400">
                {listing.experience}
              </p>
            )}
          </div>

          {showMap ? (
            <MapPreview listing={listing} compact />
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center dark:border-[#333] dark:bg-[#101010]">
              <Navigation className="mb-3 text-sky-500" size={30} />
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                {listing.serviceArea || "Atende onde o cliente precisar"}
              </p>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

function MapPreview({ listing, compact = false }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#101010]">
      <iframe
        title={`Mapa de ${listing.title || "serviço"}`}
        src={getMapUrl(listing)}
        loading="lazy"
        className={`${compact ? "h-44" : "h-64"} w-full border-0`}
      />
      <a
        href={getDirectionsUrl(listing)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 border-t border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white dark:border-[#262626]"
      >
        <ExternalLink size={15} />
        Abrir no Google Maps
      </a>
    </div>
  );
}

function InfoPill({ icon, label, value, tone }) {
  const Icon = icon;
  const tones = {
    red: "text-red-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  };

  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-[#101010]">
      <Icon className={tones[tone]} size={18} />
      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function ContactButton({ href, icon, label, value, disabled }) {
  const Icon = icon;
  const className = `flex min-h-14 items-center gap-3 rounded-xl px-4 transition ${
    disabled
      ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-[#101010]"
      : "bg-slate-950 text-white hover:bg-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
  }`;
  const content = (
    <>
      <Icon size={18} className="shrink-0" />
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">
          {label}
        </span>
        <span className="block truncate text-sm font-black">{value}</span>
      </span>
    </>
  );

  return disabled ? (
    <span className={className}>{content}</span>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  );
}

function ListingEditorModal({
  form,
  saving,
  photoUploading,
  onSubmit,
  onChange,
  onPhotoUpload,
  onPhotoRemove,
  onCancel,
}) {
  const needsAddress = ["place", "hybrid"].includes(form.serviceMode);
  const needsServiceArea = ["mobile", "hybrid"].includes(form.serviceMode);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <form
        onSubmit={onSubmit}
        className="my-4 w-full max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#222] dark:bg-[#111]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-[#222] sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              {form.id ? "Editar anúncio" : "Cadastrar serviço"}
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase italic text-slate-950 dark:text-white sm:text-3xl">
              Minha vitrine
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
              Envie seu anúncio para análise. Depois de aprovado, ele aparece no marketplace.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010]"
            title="Fechar cadastro"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <Field label="Fotos do serviço" wide>
            <div className="grid gap-3 sm:grid-cols-3">
              {(form.photos || []).map((photo) => (
                <div key={photo} className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#101010]">
                  <img src={photo} alt="" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onPhotoRemove(photo)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-red-600"
                    title="Remover foto"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {(form.photos || []).length < MAX_PHOTOS && (
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:bg-[#101010]">
                  {photoUploading ? (
                    <Wrench className="mb-2 animate-spin text-red-500" size={24} />
                  ) : (
                    <ImagePlus className="mb-2 text-red-500" size={24} />
                  )}
                  <span className="text-xs font-black uppercase tracking-widest">
                    {photoUploading ? "Enviando foto" : "Adicionar foto"}
                  </span>
                  <span className="mt-1 text-[11px] font-bold text-gray-400">
                    Até {MAX_PHOTOS} imagens
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={photoUploading}
                    onChange={onPhotoUpload}
                  />
                </label>
              )}
            </div>
          </Field>

          <Field label="Título do serviço" wide>
            <TextInput
              value={form.title}
              onChange={(event) => onChange("title", event.target.value)}
              placeholder="Limpeza premium de carros em domicílio"
            />
          </Field>
          <Field label="Nome profissional">
            <TextInput
              value={form.providerName}
              onChange={(event) => onChange("providerName", event.target.value)}
              placeholder="Seu nome ou empresa"
            />
          </Field>
          <Field label="Categoria">
            <Select
              value={form.category}
              onChange={(event) => onChange("category", event.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição completa" wide>
            <TextArea
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Explique o que você faz, diferenciais, tipo de cliente, materiais usados, garantia e detalhes importantes."
            />
          </Field>

          <Field label="Tipo de atendimento" wide>
            <div className="grid gap-2 sm:grid-cols-3">
              {["hybrid", "mobile", "place"].map((item) => {
                const Icon = modeIcons[item];
                const active = form.serviceMode === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChange("serviceMode", item)}
                    className={`min-h-24 rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:bg-[#101010] dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="mt-2 block text-xs font-black uppercase tracking-widest">
                      {modeLabels[item]}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold leading-4 opacity-75">
                      {modeCopy[item]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Cidade">
            <TextInput
              value={form.city}
              onChange={(event) => onChange("city", event.target.value)}
              placeholder="São Paulo, SP"
            />
          </Field>
          {needsAddress && (
            <Field label="Endereço físico">
              <TextInput
                value={form.address}
                onChange={(event) => onChange("address", event.target.value)}
                placeholder="Rua, número, bairro"
              />
            </Field>
          )}
          {needsServiceArea && (
            <Field label="Área que atende" wide={!needsAddress}>
              <TextInput
                value={form.serviceArea}
                onChange={(event) => onChange("serviceArea", event.target.value)}
                placeholder="Zona Sul, ABC, até 20 km, condomínios, empresas..."
              />
            </Field>
          )}

          {needsAddress && hasMapAddress(form) && (
            <div className="md:col-span-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Prévia do mapa
              </p>
              <MapPreview listing={form} />
            </div>
          )}

          <Field label="WhatsApp">
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
              <Select
                value={form.whatsappCountry || "+55"}
                onChange={(event) => {
                  onChange("whatsappCountry", event.target.value);
                  onChange("whatsapp", formatPhoneInput(form.whatsapp, event.target.value));
                }}
                aria-label="Código do país"
              >
                {phoneCountries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label} {country.code}
                  </option>
                ))}
              </Select>
              <TextInput
                value={form.whatsapp}
                onChange={(event) =>
                  onChange(
                    "whatsapp",
                    formatPhoneInput(event.target.value, form.whatsappCountry),
                  )
                }
                placeholder={form.whatsappCountry === "+1" ? "(555) 123-4567" : "(11) 99999-9999"}
                inputMode="tel"
              />
            </div>
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="contato@email.com"
            />
          </Field>
          <Field label="Preço ou faixa">
            <TextInput
              value={form.price}
              onChange={(event) => onChange("price", formatCurrencyInput(event.target.value))}
              placeholder="A partir de R$ 120"
              inputMode="numeric"
            />
          </Field>
          <Field label="Disponibilidade">
            <TextInput
              value={form.availability}
              onChange={(event) => onChange("availability", event.target.value)}
              placeholder="Segunda a sábado, 8h às 18h"
            />
          </Field>
          <Field label="Experiência" wide>
            <TextInput
              value={form.experience}
              onChange={(event) => onChange("experience", event.target.value)}
              placeholder="5 anos de experiência, atendimento para carros premium..."
            />
          </Field>
          <Field label="Tags separadas por vírgula" wide>
            <TextInput
              value={form.tags}
              onChange={(event) => onChange("tags", event.target.value)}
              placeholder="delivery, polimento, higienização, urgente"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 p-5 dark:border-[#222] sm:flex-row sm:p-6">
          <button
            type="submit"
            disabled={saving || photoUploading}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black uppercase italic text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Wrench className="animate-spin" size={18} /> : <Plus size={18} />}
            {saving ? "Enviando" : "Enviar para aprovação"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function ApprovalQueue({ listings, onApprove, onReject, onEdit }) {
  const pending = listings.filter((listing) => listing.moderationStatus === "pending");

  if (!pending.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#222] dark:bg-[#111]">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase italic tracking-widest text-slate-950 dark:text-white">
          <ShieldCheck size={18} className="text-emerald-500" />
          Aprovação de serviços
        </h2>
        <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
          Nenhum anúncio aguardando revisão agora.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 dark:bg-amber-500/5">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase italic tracking-widest text-slate-950 dark:text-white">
        <ShieldCheck size={18} className="text-amber-500" />
        Aprovação de serviços
      </h2>
      <div className="mt-4 grid gap-3">
        {pending.map((listing) => (
          <div
            key={listing.id}
            className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-[#222] dark:bg-[#151515] md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
                {listing.title}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                {listing.providerName} / {listing.category} / {listing.city || "sem cidade"}
              </p>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                {listing.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => onEdit(listing)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400"
              >
                <Edit3 size={15} />
                Revisar
              </button>
              <button
                type="button"
                onClick={() => onReject(listing)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-600 dark:bg-[#262626] dark:hover:bg-red-600"
              >
                <XCircle size={15} />
                Reprovar
              </button>
              <button
                type="button"
                onClick={() => onApprove(listing)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} />
                Aprovar
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RejectionModal({ listing, note, onChangeNote, onCancel, onConfirm }) {
  if (!listing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-[#222] dark:bg-[#111] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              Feedback do anúncio
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              Sugerir ajustes
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010] dark:text-gray-300"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333] dark:bg-[#101010]">
          <p className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
            {listing.title}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">
            {listing.providerName} / {listing.category}
          </p>
        </div>

        <label className="mt-5 grid gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Motivo ou orientação para o anunciante
          </span>
          <textarea
            value={note}
            onChange={(event) => onChangeNote(event.target.value)}
            placeholder="Ex.: inclua fotos mais claras, detalhe a área de atendimento ou ajuste o telefone de contato."
            className="min-h-36 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold leading-6 text-slate-950 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:bg-white dark:border-[#333] dark:bg-[#101010] dark:text-white dark:[color-scheme:dark] dark:placeholder:text-gray-600 dark:focus:bg-[#151515]"
          />
        </label>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black uppercase italic text-white transition hover:bg-red-700"
          >
            <XCircle size={18} />
            Enviar feedback
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300 dark:hover:text-red-400"
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}

export function Services({ user, settings }) {
  const [listings, setListings] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [mode, setMode] = useState("all");
  const [form, setForm] = useState(() => makeInitialForm(settings, user));
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const isAdmin = SERVICE_ADMIN_EMAILS.includes(String(user?.email || "").toLowerCase());

  useEffect(
    () => engineDB.subscribeServiceListings(setListings, { userId: user?.uid, isAdmin }),
    [isAdmin, user?.uid],
  );

  const myListing = useMemo(
    () => listings.find((listing) => listing.ownerId === user?.uid),
    [listings, user?.uid],
  );

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.moderationStatus === "approved"),
    [listings],
  );

  const stats = useMemo(() => {
    const mobileCount = approvedListings.filter((listing) =>
      ["mobile", "hybrid"].includes(listing.serviceMode),
    ).length;
    const cities = new Set(approvedListings.map((listing) => listing.city).filter(Boolean));
    return { total: approvedListings.length, mobileCount, cities: cities.size };
  }, [approvedListings]);

  const filteredListings = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return approvedListings.filter((listing) => {
      const matchesCategory = category === "Todos" || listing.category === category;
      const matchesMode = mode === "all" || listing.serviceMode === mode;
      const text = [
        listing.title,
        listing.providerName,
        listing.category,
        listing.description,
        listing.city,
        listing.serviceArea,
        ...(listing.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && matchesMode && (!cleanQuery || text.includes(cleanQuery));
    });
  }, [approvedListings, category, mode, query]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(makeInitialForm(settings, user));
  };

  const openEditor = (listing = null) => {
    if (listing) {
      setForm({
        ...emptyForm,
        ...listing,
        ...splitStoredPhone(listing.whatsapp, listing.whatsappCountry),
        tags: (listing.tags || []).join(", "),
        photos: listing.photos || [],
      });
    } else if (myListing) {
      setForm({
        ...emptyForm,
        ...myListing,
        ...splitStoredPhone(myListing.whatsapp, myListing.whatsappCountry),
        tags: (myListing.tags || []).join(", "),
        photos: myListing.photos || [],
      });
    } else {
      resetForm();
    }
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    resetForm();
  };

  const uploadPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (!user?.uid) {
      flash("Entre novamente para enviar fotos.");
      return;
    }

    const remainingSlots = MAX_PHOTOS - (form.photos || []).length;
    const selectedFiles = files.slice(0, remainingSlots);
    if (!selectedFiles.length) {
      flash(`Limite de ${MAX_PHOTOS} fotos por anúncio.`);
      return;
    }

    setPhotoUploading(true);
    try {
      const uploads = await Promise.all(
        selectedFiles.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error("Arquivo inválido.");
          }
          if (file.size > 6 * 1024 * 1024) {
            throw new Error("Cada foto deve ter até 6 MB.");
          }
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `users/${user.uid}/services/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
          const fileRef = ref(storage, path);
          try {
            await withUploadTimeout(
              uploadBytes(fileRef, file, { contentType: file.type }),
              "Upload da foto",
            );
            const url = await withUploadTimeout(
              getDownloadURL(fileRef),
              "Busca da foto",
            );
            return { url, fallback: false };
          } catch (error) {
            console.warn("Storage indisponível. Usando fallback comprimido.", error);
            return {
              url: await compressImageFile(file),
              fallback: true,
            };
          }
        }),
      );
      const urls = uploads.map((item) => item.url);
      setForm((current) => ({
        ...current,
        photos: [...(current.photos || []), ...urls].slice(0, MAX_PHOTOS),
      }));
      flash(
        uploads.some((item) => item.fallback)
          ? "Storage indisponível. Foto comprimida adicionada."
          : "Foto adicionada.",
      );
    } catch (error) {
      console.error(error);
      flash(error.message || "Não foi possível enviar a foto.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (photo) => {
    setForm((current) => ({
      ...current,
      photos: (current.photos || []).filter((item) => item !== photo),
    }));
  };

  const submitListing = async (event) => {
    event.preventDefault();
    if (!SUBSCRIPTION_GATE_OPEN) {
      flash("Assinatura necessária para publicar.");
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      flash("Preencha título e descrição do serviço.");
      return;
    }
    if (["place", "hybrid"].includes(form.serviceMode) && !form.address.trim()) {
      flash("Informe o endereço para exibir o mapa.");
      return;
    }
    if (["mobile", "hybrid"].includes(form.serviceMode) && !form.serviceArea.trim()) {
      flash("Informe a área de atendimento.");
      return;
    }

    setSaving(true);
    try {
      await engineDB.saveServiceListing(form, settings, user?.uid, { isAdmin });
      flash("Anúncio enviado para aprovação.");
      closeEditor();
    } catch (error) {
      console.error(error);
      flash("Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  };

  const deleteListing = async (listing) => {
    if (!window.confirm(`Excluir o anúncio "${listing.title}"?`)) return;
    try {
      await engineDB.deleteServiceListing(listing.id, user?.uid);
      flash("Anúncio removido.");
      if (form.id === listing.id) closeEditor();
    } catch (error) {
      console.error(error);
      flash("Não foi possível remover agora.");
    }
  };

  const approveListing = async (listing) => {
    try {
      await engineDB.moderateServiceListing(listing.id, "approved", "", user?.uid);
      flash("Anúncio aprovado e publicado.");
    } catch (error) {
      console.error(error);
      flash("Não foi possível aprovar agora.");
    }
  };

  const openRejectListing = (listing) => {
    setRejectionTarget(listing);
    setRejectionNote(listing.moderationNote || "");
  };

  const confirmRejectListing = async () => {
    if (!rejectionTarget) return;
    try {
      await engineDB.moderateServiceListing(
        rejectionTarget.id,
        "rejected",
        rejectionNote,
        user?.uid,
      );
      flash("Feedback enviado ao anunciante.");
      setRejectionTarget(null);
      setRejectionNote("");
    } catch (error) {
      console.error(error);
      flash("Não foi possível reprovar agora.");
    }
  };

  return (
    <section className="space-y-8 pb-10">
      {notice && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-xl bg-slate-950 px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white shadow-2xl sm:left-auto sm:right-6 sm:top-6 dark:bg-red-600">
          {notice}
        </div>
      )}

      <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-slate-950 shadow-xl dark:border-[#222] dark:bg-[#111] dark:text-white dark:shadow-none">
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-10">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                  <Sparkles size={14} />
                  Engine Services
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-gray-500 dark:text-gray-400">
                  profissionais / mapa / contato direto
                </span>
              </div>
              <h1 className="max-w-4xl text-3xl font-black uppercase italic tracking-tight sm:text-5xl md:text-6xl">
                Encontre quem resolve. Publique o que você faz.
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-gray-600 dark:text-gray-300">
                Busque serviços, veja fotos, confira se o profissional vai até você e entre em contato por WhatsApp ou e-mail.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HeroStat icon={BriefcaseBusiness} label="serviços ativos" value={stats.total} tone="red" />
              <HeroStat icon={Navigation} label="vão até você" value={stats.mobileCount} tone="sky" />
              <HeroStat icon={MapPin} label="cidades" value={stats.cities} tone="emerald" />
            </div>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#222] dark:bg-[#151515]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-red-600">
              <LockKeyhole size={22} />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              área do anunciante
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              Minha vitrine
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
              O cadastro fica em um fluxo separado, preparado para ser liberado apenas depois da assinatura.
            </p>
            {myListing && (
              <div className="mt-4">
                <StatusBadge status={myListing.moderationStatus} />
                {myListing.moderationNote && (
                  <p className="mt-2 text-xs font-bold leading-5 text-red-500">
                    {myListing.moderationNote}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => openEditor()}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black uppercase italic text-white transition hover:bg-red-700"
            >
              {myListing ? <Edit3 size={18} /> : <Plus size={18} />}
              {myListing ? "Editar meu anúncio" : "Cadastrar serviço"}
            </button>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold leading-5 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              Novos anúncios entram em aprovação antes de aparecerem na vitrine.
            </div>
          </aside>
        </div>
      </header>

      {isAdmin && (
        <ApprovalQueue
          listings={listings}
          onApprove={approveListing}
          onReject={openRejectListing}
          onEdit={openEditor}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 dark:border-[#222] dark:bg-[#111]">
          <Search size={18} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar serviço, bairro, profissional ou tag"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-600"
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 dark:border-[#222] dark:bg-[#111]">
          <Filter size={18} className="text-gray-400" />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-sm font-bold text-slate-950 outline-none dark:text-white dark:[color-scheme:dark]"
          >
            <option>Todos</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 dark:border-[#222] dark:bg-[#111]">
          <UserRoundCheck size={18} className="text-gray-400" />
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-sm font-bold text-slate-950 outline-none dark:text-white dark:[color-scheme:dark]"
          >
            <option value="all">Todos</option>
            <option value="hybrid">Local e externo</option>
            <option value="mobile">Vai até você</option>
            <option value="place">Local físico</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6">
        {filteredListings.length ? (
          filteredListings.map((listing) => (
            <ServiceCard
              key={listing.id}
              listing={listing}
              isMine={listing.ownerId === user?.uid}
              onEdit={openEditor}
              onDelete={deleteListing}
            />
          ))
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center dark:border-[#333] dark:bg-[#151515]">
            <BriefcaseBusiness className="mb-4 text-red-500" size={42} />
            <h2 className="text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              Nenhum serviço encontrado
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
              Ajuste os filtros ou cadastre um serviço pela área do anunciante.
            </p>
          </div>
        )}
      </div>

      {editorOpen && (
        <ListingEditorModal
          form={form}
          saving={saving}
          photoUploading={photoUploading}
          onSubmit={submitListing}
          onChange={updateForm}
          onPhotoUpload={uploadPhotos}
          onPhotoRemove={removePhoto}
          onCancel={closeEditor}
        />
      )}

      <RejectionModal
        listing={rejectionTarget}
        note={rejectionNote}
        onChangeNote={setRejectionNote}
        onCancel={() => {
          setRejectionTarget(null);
          setRejectionNote("");
        }}
        onConfirm={confirmRejectListing}
      />
    </section>
  );
}

function HeroStat({ icon, value, label, tone }) {
  const Icon = icon;
  const tones = {
    red: "text-red-500",
    sky: "text-sky-500",
    emerald: "text-emerald-500",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
      <Icon className={tones[tone]} size={20} />
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
