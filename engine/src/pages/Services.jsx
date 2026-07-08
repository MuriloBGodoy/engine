import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Filter,
  Gauge,
  ImagePlus,
  MapPin,
  Maximize2,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserRoundCheck,
  Wrench,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DeleteOutlineOutlined,
  EmailOutlined,
  MapOutlined,
  WhatsApp,
} from "@mui/icons-material";
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

const modeFilters = [
  { value: "all", label: "Todos" },
  { value: "hybrid", label: "Local e externo" },
  { value: "mobile", label: "Vai até você" },
  { value: "place", label: "Local físico" },
];

const statusLabels = {
  approved: "Aprovado",
  pending: "Em análise",
  changes_requested: "Ajustes necessários",
  rejected: "Recusado",
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

const getSellerProfile = (settings, user) => {
  const profile = settings?.profile || {};
  const displayName =
    profile.displayName ||
    user?.displayName ||
    String(user?.email || "").split("@")[0] ||
    "Usuario Engine";

  return {
    displayName,
    username: profile.username || "",
    city: profile.location || "",
    phone: profile.phone || "",
    avatar: profile.avatar || user?.photoURL || "",
    email: user?.email || "",
  };
};

const makeInitialForm = (settings, user) => ({
  ...emptyForm,
  providerName: getSellerProfile(settings, user).displayName,
  city: getSellerProfile(settings, user).city,
  ...splitStoredPhone(getSellerProfile(settings, user).phone),
  email: getSellerProfile(settings, user).email,
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
    changes_requested: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    rejected: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
  };
  const Icon =
    status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
        styles[status] || styles.pending
      }`}
    >
      <Icon size={13} />
      {statusLabels[status] || statusLabels.pending}
    </span>
  );
}

function ServiceCard({ listing, isMine, onEdit, onDelete, onOpen }) {
  const ModeIcon = modeIcons[listing.serviceMode] || BriefcaseBusiness;
  const phone = normalizeWhatsApp(listing.whatsapp);
  const photos = listing.photos?.length ? listing.photos : [fallbackPhoto];
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const showMap = hasMapAddress(listing);
  const stopAction = (event) => event.stopPropagation();
  const activePhoto = photos[activePhotoIndex] || photos[0];

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [listing.id]);

  const movePhoto = (event, direction) => {
    stopAction(event);
    setActivePhotoIndex((current) =>
      (current + direction + photos.length) % photos.length,
    );
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(listing)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(listing);
        }
      }}
      className="group flex min-h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-red-500/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/40 dark:border-[#222] dark:bg-[#151515] dark:shadow-none"
    >
      <div className="relative aspect-[4/3] bg-gray-100 sm:aspect-[16/10] dark:bg-[#101010]">
        <img
          src={activePhoto}
          alt={listing.title}
          onError={(event) => {
            event.currentTarget.src = fallbackPhoto;
          }}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
        <span className="absolute left-3 top-3 max-w-[calc(100%-5.75rem)] truncate rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
          {listing.category}
        </span>
        {photos.length > 1 && (
          <>
            <div className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
              {activePhotoIndex + 1}/{photos.length}
            </div>
            <button
              type="button"
              onClick={(event) => movePhoto(event, -1)}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur transition hover:bg-red-600 sm:left-3 sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100"
              title="Foto anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={(event) => movePhoto(event, 1)}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur transition hover:bg-red-600 sm:right-3 sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100"
              title="Proxima foto"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((photo, index) => (
                <button
                  key={`${listing.id}-photo-dot-${photo}-${index}`}
                  type="button"
                  onClick={(event) => {
                    stopAction(event);
                    setActivePhotoIndex(index);
                  }}
                  className={`h-1.5 rounded-full transition ${
                    index === activePhotoIndex ? "w-6 bg-white" : "w-1.5 bg-white/45"
                  }`}
                  title={`Ver foto ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-base font-black uppercase italic leading-5 tracking-tight text-slate-950 sm:text-lg sm:leading-6 dark:text-white">
              {listing.title}
            </h2>
            <p className="mt-1 truncate text-xs font-black uppercase tracking-widest text-gray-400">
              {listing.providerName || "Profissional Engine"}
            </p>
          </div>
          {isMine && (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={(event) => {
                  stopAction(event);
                  onEdit(listing);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010]"
                title="Editar anúncio"
              >
                <Edit3 size={16} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  stopAction(event);
                  onDelete(listing);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#101010]"
                title="Excluir anúncio"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <p className="line-clamp-3 min-h-[4.5rem] text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">
          {listing.description}
        </p>

        <div className="grid gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <p className="flex min-w-0 items-center gap-2">
            <ModeIcon className="shrink-0 text-red-500" size={16} />
            <span className="truncate">{modeLabels[listing.serviceMode]}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <MapPin className="shrink-0 text-emerald-500" size={16} />
            <span className="truncate">
              {listing.city || listing.serviceArea || "Atendimento a combinar"}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <Clock className="shrink-0 text-amber-500" size={16} />
            <span className="truncate">{listing.availability || "Agenda a combinar"}</span>
          </p>
          {listing.experience && (
            <p className="flex min-w-0 items-center gap-2">
              <Gauge className="shrink-0 text-sky-500" size={16} />
              <span className="truncate">{listing.experience}</span>
            </p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-[#242424]">
            <p className="min-w-0 truncate text-base font-black italic text-red-600">
              {listing.price || "Sob consulta"}
            </p>
            {isMine ? <StatusBadge status={listing.moderationStatus} /> : null}
          </div>

          {isMine && listing.moderationNote && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold leading-5 text-red-600 dark:text-red-300">
              {listing.moderationNote}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(listing.tags || []).slice(0, 3).map((tag) => (
              <span
                key={`${listing.id}-${tag}`}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:border-[#333] dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <a
              href={phone ? `https://wa.me/${phone}` : undefined}
              onClick={stopAction}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!phone}
              aria-label="Chamar no WhatsApp"
              className={`flex h-12 min-w-0 items-center justify-center rounded-lg text-sm font-black transition sm:h-11 ${
                phone
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "pointer-events-none bg-gray-100 text-gray-400 dark:bg-[#101010]"
              }`}
              title="Chamar no WhatsApp"
            >
              <WhatsApp className="shrink-0" sx={{ fontSize: 20 }} />
            </a>
            <a
              href={listing.email ? `mailto:${listing.email}?subject=${encodeURIComponent(`Contato pelo Engine: ${listing.title}`)}` : undefined}
              onClick={stopAction}
              aria-disabled={!listing.email}
              aria-label="Enviar e-mail"
              className={`flex h-12 min-w-0 items-center justify-center rounded-lg text-sm font-black transition sm:h-11 ${
                listing.email
                  ? "bg-slate-950 text-white hover:bg-red-600 dark:bg-[#262626] dark:hover:bg-red-600"
                  : "pointer-events-none bg-gray-100 text-gray-400 dark:bg-[#101010]"
              }`}
              title="Enviar e-mail"
            >
              <EmailOutlined className="shrink-0" sx={{ fontSize: 20 }} />
            </a>
            <a
              href={showMap ? getDirectionsUrl(listing) : undefined}
              onClick={stopAction}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!showMap}
              aria-label="Ver rota no mapa"
              className={`flex h-12 min-w-0 items-center justify-center rounded-lg text-sm font-black transition sm:h-11 ${
                showMap
                  ? "border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
                  : "pointer-events-none bg-gray-100 text-gray-400 dark:bg-[#101010]"
              }`}
              title="Ver rota"
            >
              <MapOutlined className="shrink-0" sx={{ fontSize: 20 }} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function ServiceDetailModal({ listing, isMine, onClose, onEdit, onDelete }) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setActivePhotoIndex(0);
    setLightboxOpen(false);
    setZoom(1);
  }, [listing?.id]);

  if (!listing) return null;

  const ModeIcon = modeIcons[listing.serviceMode] || BriefcaseBusiness;
  const phone = normalizeWhatsApp(listing.whatsapp);
  const photos = listing.photos?.length ? listing.photos : [fallbackPhoto];
  const activePhoto = photos[activePhotoIndex] || photos[0];
  const showMap = hasMapAddress(listing);
  const movePhoto = (direction) => {
    setActivePhotoIndex((current) =>
      (current + direction + photos.length) % photos.length,
    );
    setZoom(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="h-[100dvh] w-full max-w-6xl overflow-y-auto rounded-none border-0 border-gray-200 bg-white text-slate-950 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border dark:border-[#222] dark:bg-[#111] dark:text-white">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-[#222] dark:bg-[#111]/95 sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-500">
              {listing.category}
            </p>
            <h2 className="mt-1 line-clamp-2 text-lg font-black uppercase italic tracking-tight sm:truncate sm:text-2xl">
              {listing.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#191919] dark:text-gray-300 sm:h-10 sm:w-10"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 p-3 pb-28 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="min-w-0 space-y-5">
            <div className="relative overflow-hidden rounded-xl bg-gray-100 dark:bg-[#080808]">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-full cursor-zoom-in"
                title="Ampliar foto"
              >
                <img
                  src={activePhoto}
                  alt={listing.title}
                  onError={(event) => {
                    event.currentTarget.src = fallbackPhoto;
                  }}
                  className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
                />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent" />
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-red-600 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
                title="Abrir visualizacao"
              >
                <Maximize2 size={18} />
              </button>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => movePhoto(-1)}
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-red-600 sm:left-4"
                    title="Foto anterior"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(1)}
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-red-600 sm:right-4"
                    title="Proxima foto"
                  >
                    <ChevronRight size={22} />
                  </button>
                  <div className="absolute bottom-4 right-4 rounded-full bg-black/65 px-3 py-1 text-xs font-black uppercase tracking-widest text-white backdrop-blur">
                    {activePhotoIndex + 1}/{photos.length}
                  </div>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="engine-chip-scroll -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                {photos.map((photo, index) => (
                  <button
                    key={`${listing.id}-detail-photo-${photo}-${index}`}
                    type="button"
                    onClick={() => {
                      setActivePhotoIndex(index);
                      setZoom(1);
                    }}
                    className={`relative h-18 w-24 shrink-0 overflow-hidden rounded-lg border transition sm:h-24 sm:w-36 ${
                      index === activePhotoIndex
                        ? "border-red-500 ring-2 ring-red-500/25"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    title={`Ver foto ${index + 1}`}
                  >
                    <img
                      src={photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Descrição
              </p>
              <p className="mt-2 whitespace-pre-line text-sm font-medium leading-7 text-gray-600 dark:text-gray-300">
                {listing.description}
              </p>
            </div>

            {(listing.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {listing.tags.map((tag) => (
                  <span
                    key={`${listing.id}-detail-${tag}`}
                    className="rounded-full border border-gray-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:border-[#333] dark:text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {showMap && <MapPreview listing={listing} />}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#262626] dark:bg-[#151515]">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black italic text-white dark:bg-red-600">
                  {getInitials(listing.providerName || listing.title)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase italic">
                    {listing.providerName || "Profissional Engine"}
                  </p>
                  <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-gray-400">
                    {listing.city || "Online"}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-2xl font-black italic text-red-600">
                {listing.price || "Orçamento sob consulta"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <InfoPill icon={ModeIcon} label="Atendimento" value={modeLabels[listing.serviceMode]} tone="red" />
              <InfoPill icon={Clock} label="Agenda" value={listing.availability || "A combinar"} tone="amber" />
              {listing.experience && (
                <InfoPill icon={Gauge} label="Experiência" value={listing.experience} tone="sky" />
              )}
              <InfoPill icon={ShieldCheck} label="Status" value={statusLabels[listing.moderationStatus]} tone="emerald" />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#262626] dark:bg-[#151515]">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Localização
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm font-black">
                <MapPin className="mt-0.5 shrink-0 text-red-500" size={17} />
                <span>
                  {mapQuery(listing) || listing.serviceArea || "Atendimento remoto ou a combinar"}
                </span>
              </p>
            </div>

            <div className="grid gap-3">
              <ContactButton
                disabled={!phone}
                href={phone ? `https://wa.me/${phone}` : undefined}
                icon={WhatsApp}
                label="Chamar no WhatsApp"
                value={listing.whatsapp || "Sem número"}
              />
              <ContactButton
                disabled={!listing.email}
                href={listing.email ? `mailto:${listing.email}?subject=${encodeURIComponent(`Contato pelo Engine: ${listing.title}`)}` : undefined}
                icon={EmailOutlined}
                label="Enviar e-mail"
                value={listing.email || "Sem e-mail"}
              />
              <ContactButton
                disabled={!showMap}
                href={showMap ? getDirectionsUrl(listing) : undefined}
                icon={MapOutlined}
                label="Abrir mapa"
                value={showMap ? "Ver rota no Google Maps" : "Sem endereço"}
              />
            </div>

            {isMine && (
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onEdit(listing)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-600 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
                >
                  <Edit3 size={16} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(listing)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/30 text-xs font-black uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white"
                >
                  <DeleteOutlineOutlined className="shrink-0" sx={{ fontSize: 18 }} />
                  Excluir
                </button>
              </div>
            )}
          </aside>
        </div>
      </section>

      {lightboxOpen && (
        <PhotoLightbox
          listing={listing}
          photos={photos}
          activePhotoIndex={activePhotoIndex}
          zoom={zoom}
          onClose={() => {
            setLightboxOpen(false);
            setZoom(1);
          }}
          onMove={movePhoto}
          onZoomIn={() => setZoom((current) => Math.min(current + 0.25, 2.5))}
          onZoomOut={() => setZoom((current) => Math.max(current - 0.25, 1))}
          onResetZoom={() => setZoom(1)}
        />
      )}
    </div>
  );
}

function PhotoLightbox({
  listing,
  photos,
  activePhotoIndex,
  zoom,
  onClose,
  onMove,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) {
  const activePhoto = photos[activePhotoIndex] || photos[0] || fallbackPhoto;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:gap-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase italic">
            {listing.title}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/50">
            Foto {activePhotoIndex + 1} de {photos.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            title="Diminuir zoom"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="hidden h-10 items-center justify-center rounded-full bg-white/10 px-4 text-[10px] font-black uppercase tracking-widest transition hover:bg-white/20 sm:flex"
            title="Resetar zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            title="Aumentar zoom"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-700"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => onMove(-1)}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 transition hover:bg-red-600 sm:left-4 sm:h-12 sm:w-12"
            title="Foto anterior"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <img
          src={activePhoto}
          alt={listing.title}
          className="object-contain transition-[width,height] duration-200"
          style={{
            width: `${zoom * 100}%`,
            height: "auto",
            maxWidth: zoom === 1 ? "100%" : "none",
            maxHeight: zoom === 1 ? "100%" : "none",
          }}
        />
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => onMove(1)}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 transition hover:bg-red-600 sm:right-4 sm:h-12 sm:w-12"
            title="Proxima foto"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
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
    sky: "text-sky-500",
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
  sellerProfile,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-6">
      <form
        onSubmit={onSubmit}
        className="min-h-[100dvh] w-full max-w-5xl rounded-none border-0 border-gray-200 bg-white shadow-2xl sm:my-4 sm:min-h-0 sm:rounded-2xl sm:border dark:border-[#222] dark:bg-[#111]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-4 dark:border-[#222] dark:bg-[#111] sm:gap-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              {form.id ? "Editar anúncio" : "Cadastrar serviço"}
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase italic text-slate-950 dark:text-white sm:text-3xl">
              Minha vitrine
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
              Envie seu anúncio para análise. Depois de aprovado, ele aparece no marketplace.
            </p>
            <div className="mt-4 flex max-w-xl items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#151515]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950 text-sm font-black uppercase italic text-white dark:bg-red-600">
                {sellerProfile?.avatar ? (
                  <img src={sellerProfile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(sellerProfile?.displayName)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Publicado como
                </p>
                <p className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
                  {sellerProfile?.displayName || "Usuario Engine"}
                </p>
                <p className="truncate text-xs font-bold text-gray-500 dark:text-gray-400">
                  {sellerProfile?.username || sellerProfile?.email || "Conta Engine"}
                </p>
              </div>
            </div>
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

        <div className="grid gap-5 p-4 pb-28 sm:p-6 md:grid-cols-2">
          <Field label="Fotos do serviço" wide>
            <div className="grid gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {(form.photos || []).map((photo) => (
                <div key={photo} className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#101010]">
                  <img src={photo} alt="" className="h-36 w-full object-cover sm:h-32" />
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
            <div className="grid gap-2 min-[520px]:grid-cols-3">
              {["hybrid", "mobile", "place"].map((item) => {
                const Icon = modeIcons[item];
                const active = form.serviceMode === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChange("serviceMode", item)}
                    className={`min-h-20 rounded-xl border p-3 text-left transition sm:min-h-24 ${
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
            <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 sm:grid-cols-[112px_minmax(0,1fr)]">
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

function SellerProfileModal({
  sellerProfile,
  listings,
  onClose,
  onEditProfile,
  onNewListing,
}) {
  if (!sellerProfile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="w-full max-w-lg rounded-t-2xl border border-gray-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-[#222] dark:bg-[#111] dark:text-white sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-lg font-black uppercase italic text-white dark:bg-red-600">
              {sellerProfile.avatar ? (
                <img src={sellerProfile.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitials(sellerProfile.displayName)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
                conta vendedor
              </p>
              <h2 className="mt-1 truncate text-2xl font-black uppercase italic">
                Perfil vendedor
              </h2>
              <p className="mt-1 truncate text-xs font-bold text-gray-500 dark:text-gray-400">
                {sellerProfile.displayName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#191919] dark:text-gray-300"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#151515]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Conta
            </span>
            <span className="min-w-0 truncate text-xs font-bold text-gray-600 dark:text-gray-300">
              {sellerProfile.username || sellerProfile.email || "Engine"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Cidade
            </span>
            <span className="min-w-0 truncate text-xs font-bold text-gray-600 dark:text-gray-300">
              {sellerProfile.city || "Adicionar no perfil"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Status
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
              <ShieldCheck size={12} />
              {listings.length ? "Vendedor ativo" : "Pronto"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onEditProfile}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-white"
          >
            <UserRoundCheck size={16} />
            Editar perfil
          </button>
          <button
            type="button"
            onClick={onNewListing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-black uppercase italic text-white transition hover:bg-red-700"
          >
            <Plus size={16} />
            Novo serviço
          </button>
        </div>
      </section>
    </div>
  );
}

function SellerListingsModal({ listings, onClose, onEdit, onDelete, onNewListing }) {
  const [search, setSearch] = useState("");
  const cleanSearch = search.trim().toLowerCase();
  const filtered = listings.filter((listing) =>
    [
      listing.title,
      listing.category,
      listing.providerName,
      listing.city,
      statusLabels[listing.moderationStatus],
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(cleanSearch),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="flex h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-gray-200 bg-white text-slate-950 shadow-2xl dark:border-[#222] dark:bg-[#111] dark:text-white sm:h-auto sm:max-h-[82vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-[#222] sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              vitrine do vendedor
            </p>
            <h2 className="mt-1 truncate text-2xl font-black uppercase italic">
              Meus anúncios
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {listings.length === 1
                ? "1 anúncio cadastrado"
                : listings.length
                  ? `${listings.length} anúncios cadastrados`
                  : "Nenhum anúncio cadastrado"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-red-600 hover:text-white dark:bg-[#191919] dark:text-gray-300"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-200 p-4 dark:border-[#222] sm:p-5">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 dark:border-[#333] dark:bg-[#101010]">
            <Search size={17} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, categoria ou status"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-600"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {filtered.length ? (
            <div className="grid gap-3">
              {filtered.map((listing) => (
                <article
                  key={listing.id}
                  className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#151515] sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <img
                    src={listing.photos?.[0] || fallbackPhoto}
                    alt=""
                    className="h-24 w-full rounded-lg object-cover sm:h-16 sm:w-[72px]"
                    onError={(event) => {
                      event.currentTarget.src = fallbackPhoto;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={listing.moderationStatus} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {listing.category || "Serviço"}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-black uppercase italic">
                      {listing.title || "Anúncio sem título"}
                    </h3>
                    <p className="mt-1 truncate text-xs font-bold text-gray-500 dark:text-gray-400">
                      {listing.price || "Sob consulta"} / {listing.city || "Local a combinar"}
                    </p>
                    {listing.moderationNote && (
                      <p className="mt-2 line-clamp-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold leading-5 text-red-600 dark:text-red-300">
                        {listing.moderationNote}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-24 sm:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => onEdit(listing)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-600 dark:bg-[#262626]"
                    >
                      <Edit3 size={15} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(listing)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
                    >
                      <DeleteOutlineOutlined className="shrink-0" sx={{ fontSize: 17 }} />
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-6 text-center dark:border-[#333]">
              <BriefcaseBusiness className="mb-3 text-red-500" size={34} />
              <h3 className="text-lg font-black uppercase italic">
                Nenhum anúncio aqui
              </h3>
              <p className="mt-2 max-w-xs text-sm font-medium text-gray-500 dark:text-gray-400">
                {listings.length ? "Tente outro termo de busca." : "Cadastre um serviço para começar sua vitrine."}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 dark:border-[#222] sm:p-5">
          <button
            type="button"
            onClick={onNewListing}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black uppercase italic text-white transition hover:bg-red-700"
          >
            <Plus size={18} />
            Cadastrar novo serviço
          </button>
        </div>
      </section>
    </div>
  );
}

function ApprovalQueue({ listings, onApprove, onReturn, onReject, onEdit }) {
  const pending = listings.filter((listing) => listing.moderationStatus === "pending");
  const reviewed = listings
    .filter((listing) =>
      ["approved", "changes_requested", "rejected"].includes(listing.moderationStatus),
    )
    .slice(0, 8);

  if (!pending.length && !reviewed.length) {
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
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 dark:bg-amber-500/5 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase italic tracking-widest text-slate-950 dark:text-white">
        <ShieldCheck size={18} className="text-amber-500" />
        Aprovação de serviços
      </h2>
      <div className="mt-4 grid gap-3">
        {pending.map((listing) => (
          <div
            key={listing.id}
            className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-[#222] dark:bg-[#151515] sm:p-4 md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
                {listing.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-bold uppercase tracking-widest text-gray-400 sm:truncate">
                {listing.providerName} / {listing.category} / {listing.city || "sem cidade"}
              </p>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                {listing.description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:justify-end">
              <button
                type="button"
                onClick={() => onEdit(listing)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400"
              >
                <Edit3 size={15} />
                Revisar
              </button>
              <button
                type="button"
                onClick={() => onReturn(listing)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-sky-700"
              >
                <RotateCcw size={15} />
                Retornar
              </button>
              <button
                type="button"
                onClick={() => onReject(listing)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-600 dark:bg-[#262626] dark:hover:bg-red-600"
              >
                <XCircle size={15} />
                Recusar
              </button>
              <button
                type="button"
                onClick={() => onApprove(listing)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} />
                Aprovar
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-amber-500/20 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Aprovações, retornos e recusas
          </p>
          <span className="rounded-full bg-slate-950/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-white/10 dark:text-gray-300">
            {reviewed.length} registro{reviewed.length === 1 ? "" : "s"}
          </span>
        </div>
        {reviewed.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {reviewed.map((listing) => (
              <article
                key={listing.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#222] dark:bg-[#151515]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={listing.moderationStatus} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {listing.category || "Serviço"}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-black uppercase italic text-slate-950 dark:text-white">
                  {listing.title || "Anúncio sem título"}
                </h3>
                <p className="mt-1 truncate text-xs font-bold text-gray-500 dark:text-gray-400">
                  {listing.providerName} / {listing.city || "sem cidade"}
                </p>
                {listing.moderationNote && (
                  <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold leading-5 text-gray-600 dark:bg-[#101010] dark:text-gray-300">
                    {listing.moderationNote}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#222] dark:bg-[#151515]">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
              As decisões tomadas nos anúncios vão aparecer aqui, sem misturar com a fila pendente.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RejectionModal({ listing, note, action, onChangeNote, onCancel, onConfirm }) {
  if (!listing) return null;
  const isReject = action === "rejected";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-5 pb-8 shadow-2xl dark:border-[#222] dark:bg-[#111] sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
              Feedback do anúncio
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              {isReject ? "Recusar anuncio" : "Retornar ajustes"}
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
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black uppercase italic text-white transition ${
              isReject ? "bg-red-600 hover:bg-red-700" : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {isReject ? <XCircle size={18} /> : <RotateCcw size={18} />}
            {isReject ? "Recusar anuncio" : "Retornar com alteracoes"}
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
  const navigate = useNavigate();
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
  const [moderationAction, setModerationAction] = useState("changes_requested");
  const [detailListing, setDetailListing] = useState(null);
  const [sellerProfileOpen, setSellerProfileOpen] = useState(false);
  const [sellerListingsOpen, setSellerListingsOpen] = useState(false);
  const isAdmin = SERVICE_ADMIN_EMAILS.includes(String(user?.email || "").toLowerCase());
  const sellerProfile = useMemo(
    () => getSellerProfile(settings, user),
    [settings, user],
  );

  useEffect(
    () => engineDB.subscribeServiceListings(setListings, { userId: user?.uid, isAdmin }),
    [isAdmin, user?.uid],
  );

  const myListings = useMemo(
    () => listings.filter((listing) => listing.ownerId === user?.uid),
    [listings, user?.uid],
  );
  const pendingApprovalsCount = useMemo(
    () => listings.filter((listing) => listing.moderationStatus === "pending").length,
    [listings],
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
    setDetailListing(null);
    if (listing) {
      setForm({
        ...emptyForm,
        ...listing,
        ...splitStoredPhone(listing.whatsapp, listing.whatsappCountry),
        tags: (listing.tags || []).join(", "),
        photos: listing.photos || [],
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
      if (detailListing?.id === listing.id) setDetailListing(null);
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

  const openReturnListing = (listing) => {
    setModerationAction("changes_requested");
    setRejectionTarget(listing);
    setRejectionNote(listing.moderationNote || "");
  };

  const openRejectListing = (listing) => {
    setModerationAction("rejected");
    setRejectionTarget(listing);
    setRejectionNote(listing.moderationNote || "");
  };

  const confirmRejectListing = async () => {
    if (!rejectionTarget) return;
    if (!rejectionNote.trim()) {
      flash("Escreva o comentÃ¡rio para o anunciante.");
      return;
    }
    try {
      await engineDB.moderateServiceListing(
        rejectionTarget.id,
        moderationAction,
        rejectionNote,
        user?.uid,
      );
      flash(
        moderationAction === "changes_requested"
          ? "Anuncio retornado com alteracoes."
          : "Anuncio recusado com comentario.",
      );
      setRejectionTarget(null);
      setRejectionNote("");
      setModerationAction("changes_requested");
    } catch (error) {
      console.error(error);
      flash("Não foi possível reprovar agora.");
    }
  };

  return (
    <section className="space-y-5 pb-28 sm:space-y-8 sm:pb-10">
      {notice && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-xl bg-slate-950 px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white shadow-2xl sm:left-auto sm:right-6 sm:top-6 dark:bg-red-600">
          {notice}
        </div>
      )}

      <header className="-mx-4 overflow-hidden border-y border-gray-200 bg-white text-slate-950 shadow-none sm:mx-0 sm:rounded-2xl sm:border sm:shadow-xl dark:border-[#222] dark:bg-[#111] dark:text-white dark:shadow-none">
        <div className="grid gap-6 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-10">
          <div className="flex flex-col justify-between gap-6 sm:gap-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                  <Sparkles size={14} />
                  Engine Services
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500 sm:text-[10px] sm:tracking-[0.26em] dark:text-gray-400">
                  profissionais / mapa / contato direto
                </span>
              </div>
              <h1 className="max-w-4xl text-[2rem] font-black uppercase italic leading-[0.95] tracking-tight sm:text-5xl md:text-6xl">
                Encontre quem resolve. Publique o que você faz.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-gray-600 sm:text-base sm:leading-7 dark:text-gray-300">
                Busque serviços, veja fotos, confira se o profissional vai até você e entre em contato por WhatsApp ou e-mail.
              </p>
            </div>

            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
              <HeroStat icon={BriefcaseBusiness} label="serviços ativos" value={stats.total} tone="red" />
              <HeroStat icon={Navigation} label="vão até você" value={stats.mobileCount} tone="sky" />
              <HeroStat icon={MapPin} label="cidades" value={stats.cities} tone="emerald" />
            </div>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5 dark:border-[#222] dark:bg-[#151515]">
            <button
              type="button"
              onClick={() => setSellerProfileOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-red-500/60 hover:shadow-lg dark:border-[#262626] dark:bg-[#101010] dark:shadow-none"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-lg font-black uppercase italic text-white dark:bg-red-600">
                {sellerProfile.avatar ? (
                  <img src={sellerProfile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(sellerProfile.displayName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
                  conta vendedor
                </p>
                <h2 className="mt-1 truncate text-2xl font-black uppercase italic text-slate-950 dark:text-white">
                  Perfil
                </h2>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck size={12} />
                  {myListings.length ? "Vendedor ativo" : "Pronto"}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openEditor()}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black uppercase italic text-white transition hover:bg-red-700"
            >
              <Plus size={18} />
              Cadastrar novo serviço
            </button>
            <button
              type="button"
              onClick={() => setSellerListingsOpen(true)}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:bg-[#101010] dark:text-white"
            >
              <BriefcaseBusiness size={17} />
              Meus anúncios
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-[#202020] dark:text-gray-300">
                {myListings.length}
              </span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate("/services/approvals")}
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-black uppercase tracking-widest text-amber-700 transition hover:border-amber-500 hover:bg-amber-500/15 dark:text-amber-300"
              >
                <ShieldCheck size={17} />
                Aprovações
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px]">
                  {pendingApprovalsCount}
                </span>
              </button>
            )}
          </aside>
        </div>
      </header>

      <div className="space-y-3 sm:space-y-4">
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 shadow-sm sm:min-h-12 sm:rounded-xl sm:shadow-none dark:border-[#222] dark:bg-[#111]">
          <Search size={18} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar serviço, bairro, profissional ou tag"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-600"
          />
        </label>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-[#222] dark:bg-[#111] sm:rounded-xl sm:shadow-none">
          <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <Filter size={15} />
            Categoria
          </div>
          <div className="-mx-1">
            <div className="engine-chip-scroll flex gap-2 overflow-x-auto px-1 pb-2">
            {["Todos", ...categories].map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black uppercase tracking-widest transition ${
                    active
                      ? "bg-red-600 text-white shadow-sm"
                      : "border border-gray-200 text-gray-500 hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
                  }`}
                >
                  {item}
                </button>
              );
            })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-[#222] dark:bg-[#111] sm:rounded-xl sm:shadow-none">
          <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <UserRoundCheck size={15} />
            Atendimento
          </div>
          <div className="-mx-1">
            <div className="engine-chip-scroll flex gap-2 overflow-x-auto px-1 pb-2">
            {modeFilters.map((item) => {
              const active = mode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black uppercase tracking-widest transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm dark:bg-red-600"
                      : "border border-gray-200 text-gray-500 hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredListings.length ? (
          filteredListings.map((listing) => (
            <ServiceCard
              key={listing.id}
              listing={listing}
              isMine={listing.ownerId === user?.uid}
              onEdit={openEditor}
              onDelete={deleteListing}
              onOpen={setDetailListing}
            />
          ))
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center dark:border-[#333] dark:bg-[#151515] sm:col-span-2 xl:col-span-3 2xl:col-span-4">
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
          sellerProfile={sellerProfile}
          saving={saving}
          photoUploading={photoUploading}
          onSubmit={submitListing}
          onChange={updateForm}
          onPhotoUpload={uploadPhotos}
          onPhotoRemove={removePhoto}
          onCancel={closeEditor}
        />
      )}

      {sellerProfileOpen && (
        <SellerProfileModal
          sellerProfile={sellerProfile}
          listings={myListings}
          onClose={() => setSellerProfileOpen(false)}
          onEditProfile={() => {
            setSellerProfileOpen(false);
            navigate("/settings");
          }}
          onNewListing={() => {
            setSellerProfileOpen(false);
            openEditor();
          }}
        />
      )}

      {sellerListingsOpen && (
        <SellerListingsModal
          listings={myListings}
          onClose={() => setSellerListingsOpen(false)}
          onEdit={(listing) => {
            setSellerListingsOpen(false);
            openEditor(listing);
          }}
          onDelete={deleteListing}
          onNewListing={() => {
            setSellerListingsOpen(false);
            openEditor();
          }}
        />
      )}

      <ServiceDetailModal
        listing={detailListing}
        isMine={detailListing?.ownerId === user?.uid}
        onClose={() => setDetailListing(null)}
        onEdit={openEditor}
        onDelete={deleteListing}
      />

      <RejectionModal
        listing={rejectionTarget}
        note={rejectionNote}
        action={moderationAction}
        onChangeNote={setRejectionNote}
        onCancel={() => {
          setRejectionTarget(null);
          setRejectionNote("");
          setModerationAction("changes_requested");
        }}
        onConfirm={confirmRejectListing}
      />
    </section>
  );
}

export function ServiceApprovals({ user }) {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [notice, setNotice] = useState("");
  const [detailListing, setDetailListing] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [moderationAction, setModerationAction] = useState("changes_requested");
  const isAdmin = SERVICE_ADMIN_EMAILS.includes(String(user?.email || "").toLowerCase());

  useEffect(() => {
    if (!isAdmin) return undefined;
    return engineDB.subscribeServiceListings(setListings, {
      userId: user?.uid,
      isAdmin: true,
    });
  }, [isAdmin, user?.uid]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const approveListing = async (listing) => {
    try {
      await engineDB.moderateServiceListing(listing.id, "approved", "", user?.uid);
      flash("Anuncio aprovado e publicado.");
    } catch (error) {
      console.error(error);
      flash("Nao foi possivel aprovar agora.");
    }
  };

  const openReturnListing = (listing) => {
    setModerationAction("changes_requested");
    setRejectionTarget(listing);
    setRejectionNote(listing.moderationNote || "");
  };

  const openRejectListing = (listing) => {
    setModerationAction("rejected");
    setRejectionTarget(listing);
    setRejectionNote(listing.moderationNote || "");
  };

  const closeFeedback = () => {
    setRejectionTarget(null);
    setRejectionNote("");
    setModerationAction("changes_requested");
  };

  const confirmFeedback = async () => {
    if (!rejectionTarget) return;
    if (!rejectionNote.trim()) {
      flash("Escreva o comentario para o anunciante.");
      return;
    }

    try {
      await engineDB.moderateServiceListing(
        rejectionTarget.id,
        moderationAction,
        rejectionNote,
        user?.uid,
      );
      flash(
        moderationAction === "changes_requested"
          ? "Anuncio retornado com alteracoes."
          : "Anuncio recusado com comentario.",
      );
      closeFeedback();
    } catch (error) {
      console.error(error);
      flash("Nao foi possivel enviar o feedback agora.");
    }
  };

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#222] dark:bg-[#111]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
          acesso restrito
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase italic text-slate-950 dark:text-white">
          Aprovações
        </h1>
        <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">
          Esta área é exclusiva para administradores de serviços.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 pb-10">
      {notice && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-xl bg-slate-950 px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white shadow-2xl sm:left-auto sm:right-6 sm:top-6 dark:bg-red-600">
          {notice}
        </div>
      )}

      <header className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#222] dark:bg-[#111] sm:p-6">
        <button
          type="button"
          onClick={() => navigate("/services")}
          className="mb-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 px-4 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-red-500 hover:text-red-600 dark:border-[#333] dark:text-gray-300"
        >
          Voltar aos serviços
        </button>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-500">
          admin / serviços
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase italic leading-none text-slate-950 dark:text-white sm:text-5xl">
          Aprovações
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
          Fila de revisão e histórico de decisões ficam nesta página, separados da vitrine pública.
        </p>
      </header>

      <ApprovalQueue
        listings={listings}
        onApprove={approveListing}
        onReturn={openReturnListing}
        onReject={openRejectListing}
        onEdit={setDetailListing}
      />

      <ServiceDetailModal
        listing={detailListing}
        isMine={false}
        onClose={() => setDetailListing(null)}
        onEdit={() => {}}
        onDelete={() => {}}
      />

      <RejectionModal
        listing={rejectionTarget}
        note={rejectionNote}
        action={moderationAction}
        onChangeNote={setRejectionNote}
        onCancel={closeFeedback}
        onConfirm={confirmFeedback}
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
    <div className="min-w-[150px] rounded-xl border border-gray-200 bg-gray-50 p-4 sm:min-w-0 dark:border-white/10 dark:bg-white/5">
      <Icon className={tones[tone]} size={20} />
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
