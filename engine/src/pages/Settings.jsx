import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  EyeOff,
  Loader2,
  Palette,
  RefreshCw,
  Shield,
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
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { engineDB } from "../services/db";
import { auth } from "../services/firebase";
import { languageOptions } from "../services/languages";
import { countries, getStates } from "../services/locations";
import { PageHeader } from "../components/PageHeader";
import { useConfirm } from "../components/ConfirmProvider";
import { useRegion } from "../hooks/RegionProvider";

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] outline-none transition-colors focus:border-[var(--engine-accent)]";
const labelClass =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]";
const cardClass = "engine-card p-4 sm:p-6";

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
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--engine-accent)]/50"
    >
      <span className="text-sm font-semibold text-[var(--engine-text)]">
        {label}
      </span>

      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--engine-accent)]" : "bg-[var(--engine-border-strong)]"
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

const withTimeout = (promise, label, ms = 4500) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);

export function Settings({ user, settings, onSettingsUpdate }) {
  const { i18n, t } = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { region, setRegion } = useRegion();
  const [activeSection, setActiveSection] = useState("preferences");
  const [draft, setDraft] = useState(settings);
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);

  const sections = [
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


  const updateGroup = (group, key, value) => {
    setDraft((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus({ type: "", text: "" });

    try {
      const savedSettings = await engineDB.saveSettings(draft, user.uid);
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
      await sendPasswordResetEmail(auth, user.email);
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
    const ok = await confirm({
      title: t("settings.status.resetTitle"),
      message: t("settings.status.resetConfirm"),
      confirmLabel: t("settings.status.resetAction"),
    });
    if (!ok) return;

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

    const ok = await confirm({
      title: t("settings.status.deleteAccountTitle"),
      message: t("settings.status.deleteAccountConfirm"),
      confirmLabel: t("settings.actions.deleteAccountPermanent"),
    });
    if (!ok) return;

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
    <section className="space-y-6 sm:space-y-8">
      <div className="border-b border-[var(--engine-border)] pb-4 sm:pb-2">
        <PageHeader
          eyebrow="Engine Control"
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_1fr] lg:gap-8">
        {/* No mobile as seções viram uma faixa horizontal rolável: uma lista
            vertical de 6 botões em caixa alta empurrava todo o conteúdo para
            fora da primeira tela. */}
        <nav className="engine-rail -mx-4 gap-2 px-4 lg:mx-0 lg:sticky lg:top-8 lg:block lg:space-y-2 lg:self-start lg:overflow-visible lg:px-0">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold tracking-wide transition-colors lg:w-full lg:gap-3 lg:px-4 lg:py-3 lg:text-sm lg:font-black lg:uppercase lg:tracking-widest ${
                  isActive
                    ? "bg-[var(--engine-accent)] text-white shadow-[0_2px_10px_var(--engine-accent-soft)]"
                    : "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)] lg:border-0"
                }`}
              >
                <Icon size={16} className="shrink-0 lg:hidden" />
                <Icon size={18} className="hidden shrink-0 lg:block" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          <StatusMessage status={status} />

          <form onSubmit={handleSaveSettings} className="space-y-6">

            {activeSection === "preferences" && (
              <div className={cardClass}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("settings.fields.language")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.language || "pt-BR"}
                      onChange={(e) =>
                        updateGroup("preferences", "language", e.target.value)
                      }
                    >
                      {languageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("region.country")}>
                    <select
                      className={inputClass}
                      value={region.country}
                      onChange={(e) =>
                        setRegion({ country: e.target.value, state: "all" })
                      }
                    >
                      <option value="all">{t("region.all")}</option>
                      {countries.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.flag} {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {region.country !== "all" && getStates(region.country).length > 0 && (
                    <Field label={t("region.state")}>
                      <select
                        className={inputClass}
                        value={region.state}
                        onChange={(e) =>
                          setRegion({ country: region.country, state: e.target.value })
                        }
                      >
                        <option value="all">{t("region.allStates")}</option>
                        {getStates(region.country).map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
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
                  <Field label={t("settings.fields.navLayout")}>
                    <select
                      className={inputClass}
                      value={draft?.preferences?.navLayout || "sidebar"}
                      onChange={(e) =>
                        updateGroup("preferences", "navLayout", e.target.value)
                      }
                    >
                      <option value="sidebar">
                        {t("settings.options.navSidebar")}
                      </option>
                      <option value="topnav">
                        {t("settings.options.navTopnav")}
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
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--engine-accent)] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:brightness-95 disabled:opacity-50 sm:w-auto sm:py-4"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            )}
          </form>

          {activeSection === "security" && (
            <div className="space-y-6">
              <form onSubmit={handleSecuritySave} className={cardClass}>
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
                <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
                  <button
                    type="submit"
                    disabled={securityLoading}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:brightness-95 disabled:opacity-50"
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
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-text)] hover:border-[var(--engine-accent)]"
                  >
                    <Mail size={18} />
                    {t("settings.actions.verifyEmail")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-text)] hover:border-[var(--engine-accent)]"
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
            <div className={`${cardClass} space-y-6`}>
              <div>
                <h3 className="text-base font-bold uppercase tracking-tight text-[var(--engine-text)] sm:text-lg">
                  {t("settings.sections.data")}
                </h3>
                <p className="mt-1 text-sm text-[var(--engine-text-muted)]">
                  {t("settings.data.manageDesc")}
                </p>
              </div>

              <div className="grid gap-3 pt-2 sm:flex sm:flex-wrap sm:gap-4">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-text)] hover:border-[var(--engine-accent)]"
                >
                  <Download size={18} />
                  {t("settings.actions.exportBackup")}
                </button>
                <button
                  type="button"
                  onClick={handleResetLocalData}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-5 py-3 text-xs font-black uppercase tracking-widest text-amber-600 hover:border-amber-500"
                >
                  <RefreshCw size={18} />
                  {t("settings.actions.resetLocal")}
                </button>
              </div>

              <div className="border-t border-[var(--engine-border)] pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-[var(--engine-accent)]">
                    {t("settings.data.danger")}
                  </h4>
                  <p className="text-xs text-[var(--engine-text-muted)] mt-1">
                    {t("settings.data.deleteDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-3 max-w-md">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={t("settings.placeholders.deleteConfirm")}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-md hover:brightness-95"
                  >
                    <Trash2 size={18} />
                    {t("settings.actions.deleteAccountPermanent")}
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
