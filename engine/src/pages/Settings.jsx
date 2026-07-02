import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Download,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Palette,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { engineDB } from "../services/db";
import { storage } from "../services/firebase";

const inputClass =
  "w-full rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-4 py-3 text-slate-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-colors focus:border-red-600 dark:focus:border-red-500";
const labelClass =
  "text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400";

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left transition-colors hover:border-red-600/50 dark:border-[#252525] dark:bg-[#111] dark:hover:border-red-500/50"
    >
      <span className="text-sm font-bold text-slate-800 dark:text-gray-200">
        {label}
      </span>

      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-red-600" : "bg-gray-300 dark:bg-[#2a2a2a]"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

function StatusMessage({ status }) {
  if (!status.text) return null;
  const Icon = status.type === "error" ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
        status.type === "error"
          ? "border-red-600/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
          : "border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200"
      }`}
    >
      <Icon size={18} />
      {status.text}
    </div>
  );
}

async function imageToDataUrl(file) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
    throw new Error("invalid-image");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("invalid-image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("invalid-image"));
    img.src = dataUrl;
  });

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const minSide = Math.min(image.width, image.height);

  context.drawImage(
    image,
    (image.width - minSide) / 2,
    (image.height - minSide) / 2,
    minSide,
    minSide,
    0,
    0,
    size,
    size,
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("invalid-image")),
      "image/jpeg",
      0.86,
    );
  });

  return {
    blob,
    dataUrl: canvas.toDataURL("image/jpeg", 0.86),
  };
}

const withTimeout = (promise, label, ms = 9000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);

export function Settings({ user, settings, onSettingsUpdate }) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [draft, setDraft] = useState(settings);
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState(null);

  const sections = [
    { id: "profile", label: t("settings.sections.profile"), icon: User },
    {
      id: "preferences",
      label: t("settings.sections.preferences"),
      icon: Palette,
    },
    {
      id: "notifications",
      label: t("settings.sections.notifications"),
      icon: Bell,
    },
    { id: "privacy", label: t("settings.sections.privacy"), icon: EyeOff },
    { id: "security", label: t("settings.sections.security"), icon: Shield },
    { id: "data", label: t("settings.sections.data"), icon: Download },
  ];

  useEffect(() => {
    setDraft(settings);
    setEmail(user?.email || "");
  }, [settings, user]);

  const completion = useMemo(() => {
    if (!draft?.profile) return 0;
    const fields = [
      draft.profile.displayName,
      draft.profile.username,
      draft.profile.phone,
      draft.profile.location,
      draft.profile.bio,
      draft.profile.avatar,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [draft?.profile]);

  const updateGroup = (group, key, value) => {
    setDraft((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const avatar = await imageToDataUrl(file);
      setPendingAvatarBlob(avatar.blob);
      updateGroup("profile", "avatar", avatar.dataUrl);
      setStatus({ type: "success", text: t("settings.status.imageReady") });
    } catch {
      setStatus({ type: "error", text: t("modalCar.imageError") });
    } finally {
      event.target.value = "";
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus({ type: "", text: "" });

    try {
      let avatarUrl = draft.profile.avatar;

      if (pendingAvatarBlob && user) {
        try {
          const avatarRef = ref(
            storage,
            `users/${user.uid}/profile/avatar.jpg`,
          );
          await withTimeout(
            uploadBytes(avatarRef, pendingAvatarBlob, {
              contentType: "image/jpeg",
            }),
            "avatar-upload-timeout",
          );
          avatarUrl = await withTimeout(
            getDownloadURL(avatarRef),
            "avatar-url-timeout",
          );
        } catch (error) {
          console.warn("Avatar upload fallback:", error);
        }
      }

      const settingsToSave = {
        ...draft,
        profile: {
          ...draft.profile,
          username: engineDB.normalizeUsername(draft.profile.username),
          phone: engineDB.normalizePhone(draft.profile.phone),
          avatar: avatarUrl,
        },
      };

      await updateProfile(user, {
        displayName:
          settingsToSave.profile.displayName || user.displayName || "",
        photoURL:
          avatarUrl && avatarUrl.startsWith("http")
            ? avatarUrl
            : "",
      });

      const savedSettings = await engineDB.saveSettings(
        settingsToSave,
        user.uid,
      );
      setDraft(savedSettings);
      setPendingAvatarBlob(null);
      onSettingsUpdate(savedSettings);
      i18n.changeLanguage(savedSettings.preferences.language);
      setStatus({ type: "success", text: t("settings.status.saved") });
    } catch (error) {
      setStatus({
        type: "error",
        text: error?.message || t("settings.status.saveError"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    await saveSettings();
  };

  const getCredential = () => {
    if (!currentPassword) {
      throw new Error(t("settings.status.currentPassword"));
    }
    return EmailAuthProvider.credential(user.email, currentPassword);
  };

  const handleSecuritySave = async (event) => {
    event.preventDefault();
    setSecurityLoading(true);
    setStatus({ type: "", text: "" });

    try {
      const wantsEmailUpdate = email && email !== user.email;
      const wantsPasswordUpdate = newPassword || confirmPassword;

      if (wantsPasswordUpdate && newPassword !== confirmPassword) {
        throw new Error(t("settings.status.passwordMismatch"));
      }

      if (wantsEmailUpdate || wantsPasswordUpdate) {
        await reauthenticateWithCredential(user, getCredential());
      }

      if (wantsEmailUpdate) await updateEmail(user, email);
      if (wantsPasswordUpdate) await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ type: "success", text: t("settings.status.securitySaved") });
    } catch (error) {
      setStatus({
        type: "error",
        text: error?.message || t("settings.status.saveError"),
      });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      await sendEmailVerification(user);
      setStatus({
        type: "success",
        text: t("settings.status.verificationSent"),
      });
    } catch {
      setStatus({ type: "error", text: t("settings.status.saveError") });
    }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(user.auth, user.email);
      setStatus({ type: "success", text: t("settings.status.resetSent") });
    } catch {
      setStatus({ type: "error", text: t("settings.status.saveError") });
    }
  };

  const handleExport = async () => {
    const cars = await engineDB.getCars();
    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        uid: user.uid,
        email: user.email,
        displayName: draft.profile.displayName || user.displayName,
      },
      settings: draft,
      cars,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `engine-backup-${user.uid}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetLocalData = async () => {
    if (!window.confirm(t("settings.status.resetConfirm"))) return;

    await engineDB.resetDatabase();
    const resetSettings = await engineDB.resetSettings();
    setDraft(resetSettings);
    onSettingsUpdate(resetSettings);
    setStatus({ type: "success", text: t("settings.status.localReset") });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "APAGAR") {
      setStatus({ type: "error", text: t("settings.status.deleteConfirm") });
      return;
    }

    try {
      await engineDB.resetDatabase();
      await engineDB.resetSettings();
      await deleteUser(user);
      navigate("/login");
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error?.code === "auth/requires-recent-login"
            ? t("settings.status.recentLogin")
            : t("settings.status.deleteError"),
      });
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-0">
      <header className="flex flex-col gap-6 border-b border-gray-200 pb-8 dark:border-[#1f1f1f] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 dark:text-red-500">
            Engine Control
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase italic tracking-tight text-slate-950 dark:text-white lg:text-5xl">
            {t("settings.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            {t("settings.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-[#252525] bg-white dark:bg-[#111] px-5 py-4">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200 dark:bg-[#252525]">
            <div
              className="h-full rounded-full bg-red-600"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {t("settings.profileCompletion", { value: completion })}
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <nav className="space-y-2 lg:sticky lg:top-8 lg:self-start">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest transition-colors ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-100 hover:text-slate-950 dark:bg-[#111] dark:text-gray-400 dark:hover:bg-[#191919] dark:hover:text-white"
                }`}
              >
                <Icon size={18} />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          <StatusMessage status={status} />

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {activeSection === "profile" && (
              <div className="rounded-2xl border border-gray-200 dark:border-[#222] bg-white dark:bg-[#151515] p-6">
                <div className="grid gap-8 xl:grid-cols-[260px_1fr]">
                  <div className="space-y-4">
                    <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-2xl border border-gray-200 dark:border-[#292929] bg-gray-50 dark:bg-[#0f0f0f]">
                      {draft?.profile?.avatar ? (
                        <img
                          src={draft.profile.avatar}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl font-black italic text-red-600 dark:text-red-500">
                          {(
                            draft?.profile?.displayName ||
                            user?.displayName ||
                            "U"
                          )
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="absolute bottom-3 right-3 rounded-lg bg-red-600 p-2 text-white shadow-xl transition-colors hover:bg-red-700"
                        title={t("common.upload")}
                      >
                        <Camera size={18} />
                      </button>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:border-red-600 dark:hover:border-red-500"
                      >
                        <Upload size={16} />
                        {t("common.upload")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAvatarBlob(null);
                          updateGroup("profile", "avatar", "");
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-red-600 hover:text-slate-900 dark:hover:border-red-500 dark:hover:text-white"
                      >
                        <Trash2 size={16} />
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t("settings.fields.publicName")}>
                      <input
                        className={inputClass}
                        value={draft?.profile?.displayName || ""}
                        onChange={(e) =>
                          updateGroup("profile", "displayName", e.target.value)
                        }
                        placeholder={
                          user?.displayName || t("settings.placeholders.name")
                        }
                      />
                    </Field>
                    <Field label={t("settings.fields.username")}>
                      <input
                        className={inputClass}
                        value={draft?.profile?.username || ""}
                        onChange={(e) =>
                          updateGroup(
                            "profile",
                            "username",
                            engineDB.normalizeUsername(e.target.value),
                          )
                        }
                        placeholder={t("settings.placeholders.username")}
                      />
                    </Field>
                    <Field label={t("settings.fields.phone")}>
                      <input
                        className={inputClass}
                        value={draft?.profile?.phone || ""}
                        onChange={(e) =>
                          updateGroup("profile", "phone", e.target.value)
                        }
                        placeholder={t("settings.placeholders.phone")}
                      />
                    </Field>
                    <Field label={t("settings.fields.location")}>
                      <input
                        className={inputClass}
                        value={draft?.profile?.location || ""}
                        onChange={(e) =>
                          updateGroup("profile", "location", e.target.value)
                        }
                        placeholder={t("settings.placeholders.location")}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label={t("settings.fields.bio")}>
                        <textarea
                          className={`${inputClass} min-h-32`}
                          value={draft?.profile?.bio || ""}
                          onChange={(e) =>
                            updateGroup("profile", "bio", e.target.value)
                          }
                          placeholder={t("settings.placeholders.bio")}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "preferences" && (
              <div className="rounded-2xl border border-gray-200 dark:border-[#222] bg-white dark:bg-[#151515] p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("settings.fields.language")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.language || "pt-BR"}
                      onChange={(e) =>
                        updateGroup("preferences", "language", e.target.value)
                      }
                    >
                      <option value="pt-BR">
                        {t("settings.options.portuguese")}
                      </option>
                      <option value="en-US">
                        {t("settings.options.english")}
                      </option>
                      <option value="es-ES">
                        {t("settings.options.spanish")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.currency")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.currency || "BRL"}
                      onChange={(e) =>
                        updateGroup("preferences", "currency", e.target.value)
                      }
                    >
                      <option value="BRL">BRL Real</option>
                      <option value="USD">USD Dollar</option>
                      <option value="EUR">EUR Euro</option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.timezone")}>
                    <select
                      className={inputClass}
                      value={
                        draft?.preferences?.timezone || "America/Sao_Paulo"
                      }
                      onChange={(e) =>
                        updateGroup("preferences", "timezone", e.target.value)
                      }
                    >
                      <option value="America/Sao_Paulo">
                        America/Sao_Paulo
                      </option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/Lisbon">Europe/Lisbon</option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.theme")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.theme || "system"}
                      onChange={(e) =>
                        updateGroup("preferences", "theme", e.target.value)
                      }
                    >
                      <option value="dark">{t("settings.options.dark")}</option>
                      <option value="system">
                        {t("settings.options.system")}
                      </option>
                      <option value="light">
                        {t("settings.options.light")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.density")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.density || "comfortable"}
                      onChange={(e) =>
                        updateGroup("preferences", "density", e.target.value)
                      }
                    >
                      <option value="comfortable">
                        {t("settings.options.comfortable")}
                      </option>
                      <option value="compact">
                        {t("settings.options.compact")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.startPage")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.startPage || "/"}
                      onChange={(e) =>
                        updateGroup("preferences", "startPage", e.target.value)
                      }
                    >
                      <option value="/">{t("nav.home")}</option>
                      <option value="/garagem">{t("nav.garage")}</option>
                      <option value="/dashboard">{t("nav.dashboard")}</option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.garageOrder")}>
                    <select
                      className={inputClass}
                      value={
                        draft?.preferences?.defaultGarageSort || "name-asc"
                      }
                      onChange={(e) =>
                        updateGroup(
                          "preferences",
                          "defaultGarageSort",
                          e.target.value,
                        )
                      }
                    >
                      <option value="progress-desc">
                        {t("settings.options.highestProgress")}
                      </option>
                      <option value="progress-asc">
                        {t("settings.options.lowestProgress")}
                      </option>
                      <option value="target-desc">
                        {t("settings.options.highestValue")}
                      </option>
                      <option value="name-asc">
                        {t("settings.options.nameAZ")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("settings.fields.annualGoal")}>
                    <input
                      className={inputClass}
                      value={draft?.preferences?.annualIncomeGoal || ""}
                      onChange={(e) =>
                        updateGroup(
                          "preferences",
                          "annualIncomeGoal",
                          e.target.value,
                        )
                      }
                      placeholder={t("settings.placeholders.annualGoal")}
                    />
                  </Field>
                </div>
              </div>
            )}

            {activeSection === "notifications" && draft?.notifications && (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.keys(draft.notifications).map((key) => (
                  <Toggle
                    key={key}
                    label={t(`settings.toggles.${key}`)}
                    checked={draft.notifications[key]}
                    onChange={(value) =>
                      updateGroup("notifications", key, value)
                    }
                  />
                ))}
              </div>
            )}

            {activeSection === "privacy" && draft?.privacy && (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.keys(draft.privacy).map((key) => (
                  <Toggle
                    key={key}
                    label={t(`settings.toggles.${key}`)}
                    checked={draft.privacy[key]}
                    onChange={(value) => updateGroup("privacy", key, value)}
                  />
                ))}
              </div>
            )}

            {["profile", "preferences", "notifications", "privacy"].includes(
              activeSection,
            ) && (
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            )}
          </form>

          {activeSection === "security" && (
            <div className="space-y-6">
              <form
                onSubmit={handleSecuritySave}
                className="rounded-2xl border border-gray-200 dark:border-[#222] bg-white dark:bg-[#151515] p-6"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("common.email")}>
                    <input
                      type="email"
                      className={inputClass}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field label={t("common.currentPassword")}>
                    <input
                      type="password"
                      className={inputClass}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </Field>
                  <Field label={t("common.newPassword")}>
                    <input
                      type="password"
                      className={inputClass}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <Field label={t("common.confirmPassword")}>
                    <input
                      type="password"
                      className={inputClass}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={securityLoading}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {securityLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Lock size={18} />
                    )}
                    {t("settings.actions.updateSecurity")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:border-red-600 dark:hover:border-red-500"
                  >
                    <Mail size={18} />
                    {t("settings.actions.verifyEmail")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:border-red-600 dark:hover:border-red-500"
                  >
                    <KeyRound size={18} />
                    {t("settings.actions.resetEmail")}
                  </button>
                </div>
              </form>

              {draft?.security && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Toggle
                    label={t("settings.toggles.twoFactorReminder")}
                    checked={draft.security.twoFactorReminder}
                    onChange={(value) =>
                      updateGroup("security", "twoFactorReminder", value)
                    }
                  />
                  <Toggle
                    label={t("settings.toggles.loginAlerts")}
                    checked={draft.security.loginAlerts}
                    onChange={(value) =>
                      updateGroup("security", "loginAlerts", value)
                    }
                  />
                  <Field label={t("settings.fields.session")}>
                    <select
                      className={inputClass}
                      value={draft.security.sessionTimeout || "30"}
                      onChange={(e) =>
                        updateGroup(
                          "security",
                          "sessionTimeout",
                          e.target.value,
                        )
                      }
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          )}

          {activeSection === "data" && (
            <div className="rounded-2xl border border-gray-200 dark:border-[#222] bg-white dark:bg-[#151515] p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white uppercase tracking-tight">
                  {t("settings.sections.data")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Gerencie as informações locais do aplicativo e backups de
                  segurança.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:border-red-600 dark:hover:border-red-500"
                >
                  <Download size={18} />
                  Exportar Backup JSON
                </button>
                <button
                  type="button"
                  onClick={handleResetLocalData}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-[#252525] bg-white dark:bg-[#111] px-5 py-3 text-xs font-black uppercase tracking-widest text-amber-600 hover:border-amber-500"
                >
                  <RefreshCw size={18} />
                  Resetar Banco Local
                </button>
              </div>

              <div className="border-t border-gray-100 dark:border-[#222] pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-red-600 dark:text-red-500">
                    Zona de Perigo
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A exclusão da conta é permanente e removerá todos os seus
                    dados salvos do ecossistema.
                  </p>
                </div>

                <div className="flex flex-col gap-3 max-w-md">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder='Digite "APAGAR" para confirmar'
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-700 dynamic shadow-md"
                  >
                    <Trash2 size={18} />
                    Excluir Minha Conta Permanentemente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
