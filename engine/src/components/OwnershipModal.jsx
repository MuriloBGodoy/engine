import { useMemo, useState, useEffect } from "react";
import {
  X,
  Wallet,
  Fuel,
  ShieldCheck,
  Wrench,
  Landmark,
  FileBadge,
  ParkingSquare,
  Route,
  TrendingDown,
  PiggyBank,
  Save,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoTip } from "./InfoTip";
import {
  estimateOwnership,
  normalizeOwnershipInputs,
  defaultOwnershipInputs,
  DEFAULT_CONSUMPTION,
  FUEL_TYPES,
  AGE_BANDS,
  COVERAGE_TYPES,
  USAGE_TYPES,
  LIFE_SITUATIONS,
  LIFE_SITUATION_TYPES,
} from "../services/ownership";
import { countries, getStates, DEFAULT_COUNTRY } from "../services/locations";
import { fipeService } from "../services/fipeService";

const fieldClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-2.5 text-sm text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)] disabled:opacity-40";
const labelClass =
  "ml-1 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]";
const sectionTitleClass =
  "text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--engine-accent)]";

const comfortStyles = {
  comfortable:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
  critical:
    "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25",
};

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? (
        <p className="ml-1 text-[11px] text-[var(--engine-text-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

function BreakdownRow({ icon, label, value, tip = "", share = null, muted = false }) {
  const Icon = icon;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--engine-text-muted)]">
        <Icon size={14} className="shrink-0 text-[var(--engine-text-subtle)]" />
        <span className="truncate">{label}</span>
        {tip ? <InfoTip text={tip} /> : null}
      </span>
      <span className="flex shrink-0 items-baseline gap-1.5">
        {share !== null && share >= 0.005 && (
          <span className="text-[11px] tabular-nums text-[var(--engine-text-subtle)]">
            {(share * 100).toFixed(0)}%
          </span>
        )}
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            muted ? "text-[var(--engine-text-subtle)]" : "text-[var(--engine-text)]"
          }`}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

export function OwnershipModal({ isOpen, car, settings, onClose, onSave }) {
  if (!isOpen || !car) return null;
  // key={car.id} garante estado limpo do formulário a cada carro aberto.
  return (
    <OwnershipDialog
      key={car.id}
      car={car}
      settings={settings}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function OwnershipDialog({ car, settings, onClose, onSave }) {
  const { i18n, t } = useTranslation();
  const [inputs, setInputs] = useState(() =>
    car.ownership
      ? normalizeOwnershipInputs(car.ownership)
      : defaultOwnershipInputs(),
  );
  const [country, setCountry] = useState(
    () => car.ownership?.country || settings?.profile?.country || DEFAULT_COUNTRY,
  );
  const [state, setState] = useState(
    () => car.ownership?.state || settings?.profile?.state || "",
  );
  const [saving, setSaving] = useState(false);
  const [realConsumption, setRealConsumption] = useState(null);

  const states = useMemo(() => getStates(country), [country]);

  // Carregar consumo real do modelo quando abrir o modal
  useEffect(() => {
    const loadRealConsumption = async () => {
      if (car?.model) {
        const consumption = await fipeService.getConsumption(car.model);
        if (consumption) {
          setRealConsumption(consumption);
        }
      }
    };
    loadRealConsumption();
  }, [car?.model]);

  const result = useMemo(
    () => estimateOwnership(car, inputs, { country, state }),
    [car, inputs, country, state],
  );

  const money = (value) =>
    new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const set = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const saved = await onSave(car, { ...inputs, country, state });
    setSaving(false);
    if (saved) onClose();
  };

  const financing = result.financing;
  const rec = result.recommendations;
  const shareOf = (value) =>
    result.totals.monthlyTotal > 0 ? value / result.totals.monthlyTotal : null;
  // Meta de poupança: no financiado, o que falta para a entrada ideal;
  // à vista, o que falta para o valor cheio do carro.
  const savingsTarget =
    inputs.purchaseMode === "finance"
      ? rec.downPaymentGap
      : Math.max(result.value - (Number(car.savedValue) || 0), 0);
  const isFinance = inputs.purchaseMode === "finance";
  const defaultConsumption = DEFAULT_CONSUMPTION[inputs.fuelType];
  const carName = `${car.brand} ${car.model}`;

  return (
    <div className="engine-modal-overlay">
      <div className="engine-modal-panel engine-pop sm:max-w-4xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--engine-border)] px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className={sectionTitleClass}>{t("ownership.kicker")}</p>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-[var(--engine-text)] sm:text-lg">
              {t("ownership.title", { car: carName })}
            </h2>
            <p className="mt-0.5 hidden text-[13px] text-[var(--engine-text-muted)] sm:block">
              {t("ownership.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="engine-modal-body engine-scroll grid content-start gap-7 px-4 py-5 sm:gap-8 sm:px-8 sm:py-6 lg:grid-cols-[1fr_1.1fr]">
          {/* ------------------------------ Formulário ----------------------- */}
          <div className="space-y-6">
            {/* Localização */}
            <section className="space-y-3">
              <h3 className={sectionTitleClass}>{t("ownership.sections.location")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("ownership.fields.country")}>
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setState("");
                    }}
                    className={fieldClass}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("ownership.fields.state")}>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={fieldClass}
                    disabled={!states.length}
                  >
                    <option value="">—</option>
                    {states.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {/* Uso do carro */}
            <section className="space-y-3">
              <h3 className={sectionTitleClass}>{t("ownership.sections.usage")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("ownership.fields.kmPerMonth")}>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={inputs.kmPerMonth}
                    onChange={(e) => set("kmPerMonth", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t("ownership.fields.usage")}>
                  <select
                    value={inputs.usage}
                    onChange={(e) => set("usage", e.target.value)}
                    className={fieldClass}
                  >
                    {USAGE_TYPES.map((u) => (
                      <option key={u} value={u}>
                        {t(`ownership.usageOptions.${u}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("ownership.fields.fuelType")}>
                  <select
                    value={inputs.fuelType}
                    onChange={(e) => set("fuelType", e.target.value)}
                    className={fieldClass}
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {t(`ownership.fuel.${f}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    <div className="flex items-center gap-1.5">
                      {t("ownership.fields.consumption")}
                      <InfoTip text={
                        inputs.userConsumption
                          ? "Usando seu consumo informado"
                          : realConsumption && realConsumption[inputs.fuelType]
                          ? `Consumo real INMETRO: ${realConsumption[inputs.fuelType].toFixed(1)} km/l`
                          : "Usando estimativa padrão"
                      } />
                    </div>
                  }
                  hint={
                    inputs.userConsumption
                      ? `Seu consumo: ${inputs.userConsumption} km/l`
                      : realConsumption && realConsumption[inputs.fuelType]
                      ? `Real INMETRO: ${realConsumption[inputs.fuelType].toFixed(1)} km/l — edite se conhecer seu real`
                      : `Padrão: ${defaultConsumption} km/l — edite se conhecer seu real`
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder={
                      realConsumption && realConsumption[inputs.fuelType]
                        ? `Real: ${realConsumption[inputs.fuelType].toFixed(1)} km/l`
                        : `Padrão: ${defaultConsumption} km/l`
                    }
                    value={inputs.userConsumption || ""}
                    onChange={(e) => set("userConsumption", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>
            </section>

            {/* Perfil do condutor */}
            <section className="space-y-3">
              <h3 className={sectionTitleClass}>{t("ownership.sections.driver")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("ownership.fields.driverAge")}>
                  <select
                    value={inputs.driverAgeBand}
                    onChange={(e) => set("driverAgeBand", e.target.value)}
                    className={fieldClass}
                  >
                    {AGE_BANDS.map((band) => (
                      <option key={band} value={band}>
                        {t(`ownership.ageBands.${band}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("ownership.fields.coverage")}>
                  <select
                    value={inputs.coverage}
                    onChange={(e) => set("coverage", e.target.value)}
                    className={fieldClass}
                  >
                    {COVERAGE_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {t(`ownership.coverageOptions.${c}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={inputs.hasGarage}
                  onChange={(e) => set("hasGarage", e.target.checked)}
                  className="h-4 w-4 accent-[var(--engine-accent)]"
                />
                <span className="text-sm text-[var(--engine-text)]">
                  {t("ownership.fields.hasGarage")}
                </span>
              </label>
            </section>

            {/* Compra */}
            <section className="space-y-3">
              <h3 className={sectionTitleClass}>{t("ownership.sections.purchase")}</h3>
              <div className="grid grid-cols-2 gap-2">
                {["finance", "cash"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("purchaseMode", mode)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      inputs.purchaseMode === mode
                        ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-text)]"
                        : "border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:border-[var(--engine-border-strong)]"
                    }`}
                  >
                    {t(`ownership.purchaseOptions.${mode}`)}
                  </button>
                ))}
              </div>
              {isFinance && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t("ownership.fields.downPayment")}
                    hint={t("ownership.fields.downPaymentHint")}
                  >
                    <input
                      type="number"
                      min="0"
                      step="500"
                      placeholder={String(Math.round(car.savedValue || 0))}
                      value={inputs.downPaymentValue || ""}
                      onChange={(e) => set("downPaymentValue", e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label={t("ownership.fields.months")}>
                    <select
                      value={inputs.financeMonths}
                      onChange={(e) => set("financeMonths", e.target.value)}
                      className={fieldClass}
                    >
                      {[12, 24, 36, 48, 60, 72].map((m) => (
                        <option key={m} value={m}>
                          {m}x
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={
                      <div className="flex items-center gap-1.5">
                        {t("ownership.fields.monthlyRate")}
                        <InfoTip text={t("ownership.tips.monthlyRate", {
                          defaultValue: (financing?.monthlyRate * 100 || 1.99).toFixed(2)
                        })} />
                      </div>
                    }
                    hint={t("ownership.fields.monthlyRateHint", {
                      value: (financing?.monthlyRate * 100 || 1.99).toFixed(2),
                    })}
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      placeholder={((financing?.monthlyRate || 0.0199) * 100).toFixed(2)}
                      value={inputs.monthlyRatePct || ""}
                      onChange={(e) => set("monthlyRatePct", e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                </div>
              )}
            </section>

            {/* Renda e extras */}
            <section className="space-y-3">
              <h3 className={sectionTitleClass}>{t("ownership.sections.budget")}</h3>
              <div className="space-y-1">
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  {t("ownership.fields.lifeSituation")}
                  <InfoTip text={t("ownership.tips.lifeSituation")} />
                </label>
                <select
                  value={inputs.lifeSituation}
                  onChange={(e) =>
                    // Trocar a situação também sugere a % de renda adequada;
                    // o usuário pode ajustar livremente depois.
                    setInputs((prev) => ({
                      ...prev,
                      lifeSituation: e.target.value,
                      incomeSharePct:
                        LIFE_SITUATIONS[e.target.value].suggestedShare,
                    }))
                  }
                  className={fieldClass}
                >
                  {LIFE_SITUATION_TYPES.map((situation) => (
                    <option key={situation} value={situation}>
                      {t(`ownership.lifeOptions.${situation}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label={t("ownership.fields.monthlyIncome")}
                  hint={t("ownership.fields.monthlyIncomeHint")}
                >
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={inputs.monthlyIncome || ""}
                    onChange={(e) => set("monthlyIncome", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field
                  label={t("ownership.fields.incomeShare")}
                  hint={t("ownership.fields.incomeShareHint", {
                    pct: LIFE_SITUATIONS[inputs.lifeSituation].suggestedShare,
                  })}
                >
                  <input
                    type="number"
                    min="5"
                    max="60"
                    step="1"
                    value={inputs.incomeSharePct}
                    onChange={(e) => set("incomeSharePct", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t("ownership.fields.parking")}>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={inputs.parkingMonthly || ""}
                    onChange={(e) => set("parkingMonthly", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t("ownership.fields.tolls")}>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={inputs.tollsMonthly || ""}
                    onChange={(e) => set("tollsMonthly", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* ------------------------------ Resultado ------------------------ */}
          <div className="space-y-4">
            {/* Números principais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--engine-accent)]/25 bg-[var(--engine-accent-soft)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-accent)]">
                  {t("ownership.results.monthlyTotal")}
                </p>
                <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-[var(--engine-text)] sm:text-2xl">
                  {money(result.totals.monthlyTotal)}
                </p>
                <p className="text-[11px] text-[var(--engine-text-muted)]">
                  {t("ownership.results.perMonth")}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("ownership.results.requiredIncome")}
                  <InfoTip text={t("ownership.tips.requiredIncome")} align="right" />
                </p>
                <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-[var(--engine-text)] sm:text-2xl">
                  {money(rec.requiredIncomeTotal)}
                </p>
                <p className="text-[11px] text-[var(--engine-text-muted)]">
                  {t("ownership.results.requiredIncomeHint", {
                    pct: rec.incomeSharePct,
                  })}
                </p>
              </div>
            </div>

            {/* Comprometimento da renda informada */}
            {rec.comfortLevel && (
              <div
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold ${comfortStyles[rec.comfortLevel]}`}
              >
                <span className="flex items-center gap-1.5">
                  {t(`ownership.results.comfort.${rec.comfortLevel}`)}
                  <InfoTip
                    text={t("ownership.tips.comfort", {
                      comfortable: Math.round(
                        rec.comfortThresholds.comfortable * 100,
                      ),
                      warning: Math.round(rec.comfortThresholds.warning * 100),
                    })}
                  />
                </span>
                <span className="tabular-nums">
                  {(rec.committedPct * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {/* Breakdown */}
            <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("ownership.results.breakdown")}
              </p>
              <div className="divide-y divide-[var(--engine-border)]">
                {isFinance && result.monthly.financing > 0 && (
                  <BreakdownRow
                    icon={Wallet}
                    label={t("ownership.results.installment")}
                    tip={t("ownership.tips.installment")}
                    value={money(result.monthly.financing)}
                    share={shareOf(result.monthly.financing)}
                  />
                )}
                <BreakdownRow
                  icon={Landmark}
                  label={
                    result.country === "BR"
                      ? t("ownership.results.taxBR")
                      : t("ownership.results.tax")
                  }
                  tip={
                    result.country === "BR"
                      ? t("ownership.tips.taxBR")
                      : t("ownership.tips.tax")
                  }
                  value={money(result.monthly.tax)}
                  share={shareOf(result.monthly.tax)}
                />
                <BreakdownRow
                  icon={FileBadge}
                  label={t("ownership.results.licensing")}
                  tip={t("ownership.tips.licensing")}
                  value={money(result.monthly.licensing)}
                  share={shareOf(result.monthly.licensing)}
                />
                <BreakdownRow
                  icon={ShieldCheck}
                  label={t("ownership.results.insurance")}
                  tip={t("ownership.tips.insurance")}
                  value={money(result.monthly.insurance)}
                  share={shareOf(result.monthly.insurance)}
                />
                <BreakdownRow
                  icon={Fuel}
                  label={t("ownership.results.fuel")}
                  tip={t("ownership.tips.fuel")}
                  value={money(result.monthly.fuel)}
                  share={shareOf(result.monthly.fuel)}
                />
                <BreakdownRow
                  icon={Wrench}
                  label={t("ownership.results.maintenance")}
                  tip={t("ownership.tips.maintenance")}
                  value={money(result.monthly.maintenance)}
                  share={shareOf(result.monthly.maintenance)}
                />
                {result.monthly.parking > 0 && (
                  <BreakdownRow
                    icon={ParkingSquare}
                    label={t("ownership.results.parking")}
                    value={money(result.monthly.parking)}
                    share={shareOf(result.monthly.parking)}
                  />
                )}
                {result.monthly.tolls > 0 && (
                  <BreakdownRow
                    icon={Route}
                    label={t("ownership.results.tolls")}
                    value={money(result.monthly.tolls)}
                    share={shareOf(result.monthly.tolls)}
                  />
                )}
                <BreakdownRow
                  icon={TrendingDown}
                  label={t("ownership.results.depreciation")}
                  tip={t("ownership.tips.depreciation")}
                  value={money(result.monthly.depreciation)}
                  muted
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--engine-text-subtle)]">
                {t("ownership.results.depreciationNote")}
              </p>
            </div>

            {/* Financiamento */}
            {isFinance && financing && financing.principal > 0 && (
              <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("ownership.results.financingTitle")}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <span className="text-[var(--engine-text-muted)]">
                    {t("ownership.results.downPayment")}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(financing.downPayment)} (
                    {(financing.downPaymentPct * 100).toFixed(0)}%)
                  </span>
                  <span className="text-[var(--engine-text-muted)]">
                    {t("ownership.results.financedAmount")}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(financing.principal)} · {financing.months}x
                  </span>
                  <span className="text-[var(--engine-text-muted)]">
                    {t("ownership.results.totalInterest")}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[var(--engine-accent)]">
                    {money(financing.totalInterest)}
                  </span>
                  <span className="text-[var(--engine-text-muted)]">
                    {t("ownership.results.totalPaid")}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(financing.totalPaid)}
                  </span>
                </div>
              </div>
            )}

            {/* Plano de conquista */}
            <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                <PiggyBank size={13} />
                {t("ownership.results.recTitle")}
              </p>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--engine-text-muted)]">
                    {t("ownership.results.idealDown")}
                    <InfoTip text={t("ownership.tips.idealDown")} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(rec.recommendedDownPayment)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--engine-text-muted)]">
                    {rec.downPaymentGap > 0
                      ? t("ownership.results.downGap")
                      : t("ownership.results.downReady")}
                  </span>
                  {rec.downPaymentGap > 0 && (
                    <span className="font-semibold tabular-nums text-[var(--engine-accent)]">
                      {money(rec.downPaymentGap)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--engine-text-muted)]">
                    {t("ownership.results.emergencyFund")}
                    <InfoTip text={t("ownership.tips.emergencyFund")} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(rec.emergencyFund)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--engine-text-muted)]">
                    {t("ownership.results.maintainOnly")}
                    <InfoTip text={t("ownership.tips.maintainOnly")} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(rec.requiredIncomeMaintain)}
                  </span>
                </div>
              </div>

              {savingsTarget > 0 && (
                <div className="mt-3 border-t border-[var(--engine-border)] pt-3">
                  <p className="text-[12px] font-semibold text-[var(--engine-text)]">
                    {t("ownership.results.savePlanTitle", {
                      amount: money(savingsTarget),
                    })}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[6, 12, 24].map((months) => (
                      <div
                        key={months}
                        className="rounded-xl bg-[var(--engine-surface-2)] px-2 py-2 text-center"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--engine-text-subtle)]">
                          {t("ownership.results.savePlanMonths", { months })}
                        </p>
                        <p className="mt-0.5 text-sm font-extrabold tabular-nums text-[var(--engine-accent)]">
                          {money(savingsTarget / months)}
                        </p>
                        <p className="text-[10px] text-[var(--engine-text-subtle)]">
                          {t("ownership.results.savePlanPerMonth")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--engine-text-subtle)]">
              {t("ownership.disclaimer")}
            </p>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="hidden w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] py-3 font-semibold tracking-tight text-white shadow-[0_2px_10px_var(--engine-accent-soft)] transition-colors hover:brightness-95 disabled:opacity-50 lg:flex"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {t("ownership.save")}
            </button>
          </div>
        </div>

        {/* Resumo fixo no mobile: mantém o resultado à vista enquanto o
            usuário mexe no formulário (no desktop o painel já fica ao lado). */}
        <div className="engine-safe-bottom shrink-0 space-y-2.5 border-t border-[var(--engine-border)] bg-[var(--engine-elevated)] px-4 pt-3 sm:px-6 lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("ownership.results.monthlyTotal")}
              </p>
              <p className="text-lg font-extrabold leading-tight tabular-nums text-[var(--engine-accent)]">
                {money(result.totals.monthlyTotal)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("ownership.results.requiredIncome")}
              </p>
              <p className="text-lg font-extrabold leading-tight tabular-nums text-[var(--engine-text)]">
                {money(rec.requiredIncomeTotal)}
              </p>
            </div>
          </div>
          {/* Salvar fica sempre à mão no celular — antes só existia no fim de
              uma rolagem bem longa. */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] font-semibold tracking-tight text-white transition-colors hover:brightness-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("ownership.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
