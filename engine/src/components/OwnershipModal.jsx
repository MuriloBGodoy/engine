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
  Receipt,
  Save,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoTip } from "./InfoTip";
import {
  estimateOwnership,
  estimateOwnershipRange,
  assessAffordability,
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
import { pickReferenceCar } from "../services/expenses";
import { engineDB } from "../services/db";
import { countries, getStates, DEFAULT_COUNTRY } from "../services/locations";
import { fipeService } from "../services/fipeService";
import { consumptionFor } from "../services/consumption";

const fieldClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-2.5 text-sm text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)] disabled:opacity-40";

/**
 * Campos que só existem no modo Avançado. Servem para duas coisas: decidir em
 * que modo o simulador reabre, e saber o que continua valendo no cálculo mesmo
 * quando some da tela.
 */
const ADVANCED_ONLY_FIELDS = [
  "usage",
  "fuelType",
  "userConsumption",
  "driverAgeBand",
  "hasGarage",
  "monthlyRatePct",
  "parkingMonthly",
  "tollsMonthly",
];

/**
 * O que o modo Padrão pergunta. A escolha saiu de medir quanto cada campo
 * reduz a incerteza do resultado, não de agrupar por tema: entrada, prazo e
 * km/mês sozinhos cortam 44 dos 69 pontos de dispersão, enquanto faixa etária,
 * garagem, uso e combustível somados valem cerca de 2.
 */
const STANDARD_FIELDS = [
  "purchaseMode",
  "downPaymentValue",
  "financeMonths",
  "kmPerMonth",
  "coverage",
];

/** Faixas de rodagem: a ordem de grandeza é o que importa, não o número exato. */
const KM_BANDS = [
  { key: "little", value: 600 },
  { key: "normal", value: 1200 },
  { key: "much", value: 2500 },
  { key: "work", value: 4000 },
];
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

export function OwnershipModal({
  isOpen,
  car,
  cars = [],
  settings,
  onClose,
  onSave,
  onSettingsUpdate,
}) {
  if (!isOpen || !car) return null;
  // key={car.id} garante estado limpo do formulário a cada carro aberto.
  return (
    <OwnershipDialog
      key={car.id}
      car={car}
      cars={cars}
      settings={settings}
      onClose={onClose}
      onSave={onSave}
      onSettingsUpdate={onSettingsUpdate}
    />
  );
}

function OwnershipDialog({ car, cars, settings, onClose, onSave, onSettingsUpdate }) {
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
  // Campos que a pessoa informou de verdade. Tudo que não está aqui é
  // suposição do modelo, e é o que alarga a faixa do resultado.
  const [touched, setTouched] = useState(
    () => new Set(car.ownership?.touched || []),
  );
  // Quem nunca simulou este carro começa no Padrão; quem já mexeu nos campos
  // avançados volta para onde estava.
  const [mode, setMode] = useState(() =>
    (car.ownership?.touched || []).some((field) => ADVANCED_ONLY_FIELDS.includes(field))
      ? "advanced"
      : "standard",
  );

  const states = useMemo(() => getStates(country), [country]);

  // Consumo do modelo, da base local do INMETRO — síncrono, então é valor
  // derivado e não estado. Vinha só do backend, que em produção não existe, e
  // mesmo em dev o número era exibido como dica e nunca entrava na conta: o
  // combustível saía do padrão do tipo, igual para um Mobi e para uma Hilux.
  const localConsumption = useMemo(() => consumptionFor(car?.model), [car?.model]);

  // O backend continua sendo consultado por cima, porque pode ter base mais
  // nova que a embarcada. Guarda o modelo junto para não aplicar a resposta de
  // um carro no carro seguinte.
  useEffect(() => {
    if (!car?.model) return undefined;
    let alive = true;
    fipeService
      .getConsumption(car.model)
      .then((data) => {
        if (alive && data) setRealConsumption({ model: car.model, data });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [car?.model]);

  const modelConsumption =
    (realConsumption?.model === car?.model ? realConsumption.data : null) ||
    localConsumption;

  // Renda e despesa são da pessoa e vivem em `settings`; a migração aceita o
  // valor antigo que ficou preso em `car.ownership.monthlyIncome`.
  const [budget, setBudget] = useState(() => ({
    ...(settings?.budget || {}),
    monthlyIncome:
      settings?.budget?.monthlyIncome || Number(car.ownership?.monthlyIncome) || 0,
  }));

  // O veredito na tela reage a cada tecla, mas a GRAVAÇÃO não: escrever a cada
  // caractere transformava digitar "4500" em quatro escritas no Firestore, e a
  // cota diária do plano gratuito é contada em escritas. Persiste ao sair do
  // campo, que é quando o valor está inteiro de qualquer forma.
  const updateBudget = (patch) => {
    setBudget((prev) => ({ ...prev, ...patch }));
  };

  const persistBudget = () => {
    if (JSON.stringify(budget) === JSON.stringify(settings?.budget || {})) return;
    const next = { ...budget, updatedAt: new Date().toISOString() };
    engineDB
      .saveSettings({ ...settings, budget: next })
      .then((saved) => onSettingsUpdate?.(saved))
      .catch(() => {});
  };

  // A renda mora em `settings.budget`, mas o motor continua recebendo pelos
  // inputs — assim a regra de comprometimento segue funcionando sem duplicar
  // o campo em dois lugares que podem divergir.
  // `consumption` é o degrau do meio da hierarquia do motor (usuário > modelo >
  // padrão do combustível). Estava reservado e vazio; agora recebe o número do
  // INMETRO, então o combustível passa a ser do carro e não do tipo de motor.
  const effectiveInputs = useMemo(
    () => ({
      ...inputs,
      monthlyIncome: Number(budget.monthlyIncome) || 0,
      consumption:
        Number(inputs.consumption) > 0
          ? Number(inputs.consumption)
          : Number(modelConsumption?.[inputs.fuelType]) || 0,
    }),
    [inputs, budget.monthlyIncome, modelConsumption],
  );

  const result = useMemo(
    () => estimateOwnership(car, effectiveInputs, { country, state }),
    [car, effectiveInputs, country, state],
  );

  // No Padrão, tudo que não foi informado e não está no formulário simples é
  // suposição — e é isso que a faixa mede. No Avançado a pessoa vê todos os
  // campos, então o que sobrar sem toque foi visto e aceito.
  const unknownFields = useMemo(() => {
    if (mode === "advanced") return [];
    return [
      "driverAgeBand",
      "hasGarage",
      "usage",
      "monthlyRatePct",
      "userConsumption",
      "kmPerMonth",
    ].filter((field) => !touched.has(field));
  }, [mode, touched]);

  const range = useMemo(
    () => estimateOwnershipRange(car, effectiveInputs, { country, state }, unknownFields),
    [car, effectiveInputs, country, state, unknownFields],
  );

  // O número que vai para a conta de renda é o TETO. Subestimar coloca alguém
  // num contrato que não paga; superestimar custa um carro que caberia.
  const headlineCost = range.high;

  // A mesma conta com a outra forma de compra. O contraste é o dado mais forte
  // do simulador — financiar costuma mais que dobrar a renda necessária — e até
  // agora dependia de a pessoa lembrar de simular duas vezes. Custa ~1 ms.
  const altPurchase = inputs.purchaseMode === "finance" ? "cash" : "finance";
  const altRange = useMemo(
    () =>
      estimateOwnershipRange(
        car,
        { ...effectiveInputs, purchaseMode: altPurchase },
        { country, state },
        unknownFields,
      ),
    [car, effectiveInputs, altPurchase, country, state, unknownFields],
  );

  // "Quanto preciso ganhar" é a pergunta que traz alguém ao simulador. Sai do
  // teto da faixa pela mesma razão que o resto.
  const sharePct = inputs.incomeSharePct || 20;
  const requiredIncome = headlineCost / (sharePct / 100);
  const altRequiredIncome = altRange.high / (sharePct / 100);

  // Carro da garagem com gasto lançado: serve de régua real contra a projeção.
  const reference = useMemo(() => pickReferenceCar(cars, car.id), [cars, car.id]);

  const measured = reference?.insights;
  // Só oferece aplicar o que ainda não foi aplicado — botão que não muda nada
  // é ruído.
  const canApplyMeasured =
    measured &&
    ((measured.kmPerMonth && Math.round(measured.kmPerMonth) !== Math.round(inputs.kmPerMonth)) ||
      (measured.consumption &&
        measured.consumption.kmPerLiter.toFixed(1) !==
          Number(inputs.userConsumption || 0).toFixed(1)));

  const applyMeasured = () => {
    setInputs((prev) => ({
      ...prev,
      kmPerMonth: measured.kmPerMonth ? Math.round(measured.kmPerMonth) : prev.kmPerMonth,
      userConsumption: measured.consumption
        ? Number(measured.consumption.kmPerLiter.toFixed(1))
        : prev.userConsumption,
    }));
  };

  const money = (value) =>
    new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const set = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  };

  const handleSave = async () => {
    setSaving(true);
    const saved = await onSave(car, {
      ...inputs,
      country,
      state,
      touched: [...touched],
    });
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

        <div className="engine-modal-body engine-modal-split engine-scroll grid content-start gap-7 px-4 py-5 sm:gap-8 sm:px-8 sm:py-6 lg:grid-cols-[1fr_1.1fr]">
          {/* ------------------------------ Formulário ----------------------- */}
          <div className="engine-modal-col engine-scroll space-y-6">
            {/* Trocar de modo não mexe nos dados, só no que aparece. O que foi
                digitado no Avançado continua valendo no Padrão — some da tela,
                não da conta —, e por isso o número não pode mudar na troca. */}
            <div className="flex gap-1.5 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-1">
              {["standard", "advanced"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                    mode === option
                      ? "bg-[var(--engine-accent)] text-white"
                      : "text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
                  }`}
                >
                  {t(`ownership.modes.${option}`)}
                </button>
              ))}
            </div>

            {mode === "standard" && (
              <>
                <p className="text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
                  {t("ownership.modes.standardHint", { location: state || country })}
                </p>

                <section className="space-y-3">
                  <h3 className={sectionTitleClass}>{t("ownership.fields.kmPerMonth")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {KM_BANDS.map((band) => (
                      <button
                        key={band.key}
                        type="button"
                        onClick={() => set("kmPerMonth", band.value)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          Number(inputs.kmPerMonth) === band.value
                            ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)]"
                            : "border-[var(--engine-border)] hover:border-[var(--engine-accent)]"
                        }`}
                      >
                        <span className="block text-[12px] font-bold text-[var(--engine-text)]">
                          {t(`ownership.kmBands.${band.key}`)}
                        </span>
                        <span className="block text-[11px] tabular-nums text-[var(--engine-text-subtle)]">
                          ~{band.value.toLocaleString(i18n.language)} km
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className={sectionTitleClass}>{t("ownership.fields.coverage")}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {COVERAGE_TYPES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => set("coverage", option)}
                        className={`rounded-xl border px-2 py-2.5 text-[11px] font-bold transition ${
                          inputs.coverage === option
                            ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                            : "border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)]"
                        }`}
                      >
                        {t(`ownership.coverageOptions.${option}`)}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {mode === "advanced" && (
            <>
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
                          : modelConsumption && modelConsumption[inputs.fuelType]
                          ? `Consumo real INMETRO: ${modelConsumption[inputs.fuelType].toFixed(1)} km/l`
                          : "Usando estimativa padrão"
                      } />
                    </div>
                  }
                  hint={
                    inputs.userConsumption
                      ? `Seu consumo: ${inputs.userConsumption} km/l`
                      : modelConsumption && modelConsumption[inputs.fuelType]
                      ? `Real INMETRO: ${modelConsumption[inputs.fuelType].toFixed(1)} km/l — edite se conhecer seu real`
                      : `Padrão: ${defaultConsumption} km/l — edite se conhecer seu real`
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder={
                      modelConsumption && modelConsumption[inputs.fuelType]
                        ? `Real: ${modelConsumption[inputs.fuelType].toFixed(1)} km/l`
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
            </>
            )}

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
                  {/* Juros só no Avançado. Entrada e prazo a pessoa sabe e
                      escolhe; a taxa ela só descobre no banco, depois de
                      decidir. Perguntar um número que ninguém tem antes da
                      hora é convidar um chute — e chute que compõe por 48
                      meses é o pior tipo de entrada errada. No Padrão a taxa
                      média entra como suposição declarada e a incerteza dela
                      vai para a faixa, que é onde risco desconhecido deve
                      aparecer. */}
                  {mode === "advanced" && (
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
                  )}
                </div>
              )}
              {mode === "standard" && isFinance && (
                <p className="rounded-xl border border-dashed border-[var(--engine-border)] px-3 py-2 text-[11px] leading-relaxed text-[var(--engine-text-muted)]">
                  {t("ownership.fields.rateAssumed", {
                    rate: ((financing?.monthlyRate || 0.0199) * 100)
                      .toFixed(2)
                      .replace(".", i18n.language.startsWith("en") ? "." : ","),
                  })}
                </p>
              )}
            </section>

            {/* Renda e extras */}
            {mode === "advanced" && (
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
            )}
          </div>

          {/* ------------------------------ Resultado ------------------------ */}
          <div className="engine-modal-col engine-scroll space-y-4">
            {/* Números principais.

                A hierarquia troca com o modo, de propósito. No Padrão a
                pergunta é "quanto preciso ganhar para ter esse carro?" — quem
                abre o simulador sonhando ainda não sabe a própria conta, e a
                renda necessária é a resposta. No Avançado a pessoa já informou
                renda e despesa; ali o custo mensal é o que ela veio conferir. */}
            <div className="grid grid-cols-2 gap-3">
              {(mode === "standard"
                ? ["requiredIncome", "monthlyTotal"]
                : ["monthlyTotal", "requiredIncome"]
              ).map((tile, index) => {
                const isHero = index === 0;
                const shell = isHero
                  ? "rounded-2xl border border-[var(--engine-accent)]/25 bg-[var(--engine-accent-soft)] p-4"
                  : "rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4";
                const kicker = isHero
                  ? "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-accent)]"
                  : "text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]";

                if (tile === "monthlyTotal") {
                  return (
                    <div key={tile} className={shell}>
                      <p className={kicker}>{t("ownership.results.monthlyTotal")}</p>
                      <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-[var(--engine-text)] sm:text-2xl">
                        {money(headlineCost)}
                      </p>
                      {/* Com campos por informar, o número é o teto de uma
                          faixa — e a faixa aparece, senão o teto viraria uma
                          precisão que não existe. Ela estreita conforme a
                          pessoa preenche. */}
                      <p className="text-[11px] text-[var(--engine-text-muted)]">
                        {unknownFields.length > 0
                          ? t("ownership.results.rangeHint", {
                              low: money(range.low),
                              high: money(range.high),
                            })
                          : t("ownership.results.perMonth")}
                      </p>
                    </div>
                  );
                }

                return (
                  <div key={tile} className={shell}>
                    <p className={`flex items-center gap-1.5 ${kicker}`}>
                      {t("ownership.results.requiredIncome")}
                      <InfoTip
                        text={t("ownership.tips.requiredIncome")}
                        align={isHero ? "left" : "right"}
                      />
                    </p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-[var(--engine-text)] sm:text-2xl">
                      {money(requiredIncome)}
                    </p>
                    <p className="text-[11px] text-[var(--engine-text-muted)]">
                      {t("ownership.results.requiredIncomeHint", { pct: sharePct })}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Quanto da renda a pessoa aceita entregar ao carro é preferência,
                não dado a descobrir — então vale nos dois modos, e fica junto
                do resultado que ela move, não perdido no formulário. */}
            <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[11px] font-semibold text-[var(--engine-text-muted)]">
                  {t("ownership.results.shareLabel")}
                </span>
                {/* Digitável de 1 a 100. Os atalhos cobrem as três sugestões de
                    LIFE_SITUATIONS (15, 20 e 35), mas quem quiser 47% escreve
                    47 — travar a régua fazia o simulador recusar a conta de
                    quem já vive com o carro pesando mais do que devia. */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={sharePct}
                    onChange={(e) => set("incomeSharePct", e.target.value)}
                    className="w-20 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-2.5 py-1.5 text-center text-[13px] font-bold tabular-nums text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)]"
                  />
                  <span className="text-[13px] font-bold text-[var(--engine-text-muted)]">%</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 15, 20, 25, 30, 35, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => set("incomeSharePct", pct)}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold tabular-nums transition-colors ${
                        sharePct === pct
                          ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                          : "border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)]"
                      }`}
                    >
                      {pct}
                    </button>
                  ))}
                </div>
              </div>
              {/* Acima do limite da situação de vida, avisa — sem impedir. */}
              {sharePct > (LIFE_SITUATIONS[inputs.lifeSituation]?.warning || 0.3) * 100 && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                  {t("ownership.results.shareWarning", {
                    pct: sharePct,
                    limit: Math.round(
                      (LIFE_SITUATIONS[inputs.lifeSituation]?.warning || 0.3) * 100,
                    ),
                  })}
                </p>
              )}
            </div>

            {/* À vista contra financiado. Era o número mais forte do simulador
                e o único que exigia simular duas vezes para enxergar. */}
            {result.value > 0 && (
              <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("ownership.results.compareTitle")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--engine-accent)]">
                      {t(`ownership.purchaseOptions.${inputs.purchaseMode}`)}
                    </p>
                    <p className="text-base font-extrabold tabular-nums text-[var(--engine-text)]">
                      {money(requiredIncome)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--engine-text-muted)]">
                      {t(`ownership.purchaseOptions.${altPurchase}`)}
                    </p>
                    <p className="text-base font-extrabold tabular-nums text-[var(--engine-text-muted)]">
                      {money(altRequiredIncome)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--engine-text-muted)]">
                  {t("ownership.results.compareHint", {
                    times: (
                      Math.max(requiredIncome, altRequiredIncome) /
                      Math.max(Math.min(requiredIncome, altRequiredIncome), 1)
                    )
                      .toFixed(1)
                      .replace(".", i18n.language.startsWith("en") ? "." : ","),
                  })}
                </p>
              </div>
            )}

            {/* Sobra ou não sobra. Fica no bloco de RESULTADO, e não no
                formulário, de propósito: a pessoa preenche porque quer a
                resposta, não porque um campo exigiu. Sem preencher, a tela
                segue funcionando com a regra de % de sempre. */}
            <BudgetBlock
              t={t}
              money={money}
              monthlyCost={headlineCost}
              budget={budget}
              currentCar={reference}
              onChange={updateBudget}
              onCommit={persistBudget}
              lifeSituation={inputs.lifeSituation}
            />

            {/* Régua real: a comparação usa `monthlyMaintain`, sem a parcela do
                financiamento nem a depreciação, porque é o que sai do bolso
                todo mês — que é o mesmo tipo de número que a pessoa lançou. */}
            {measured && (
              <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  <Receipt size={12} className="text-[var(--engine-accent)]" />
                  {t("ownership.results.realTitle")}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--engine-text)]">
                  {reference.isSelf
                    ? t("ownership.results.realSelf", {
                        estimate: money(result.totals.monthlyMaintain),
                        actual: money(measured.monthlyAverage),
                      })
                    : t("ownership.results.realCompare", {
                        current: `${reference.car.brand} ${reference.car.model}`,
                        actual: money(measured.monthlyAverage),
                        target: carName,
                        estimate: money(result.totals.monthlyMaintain),
                      })}
                </p>
                {!reference.isSelf && (
                  <p className="mt-1 text-[13px] font-bold text-[var(--engine-accent)]">
                    {t(
                      result.totals.monthlyMaintain >= measured.monthlyAverage
                        ? "ownership.results.realMore"
                        : "ownership.results.realLess",
                      {
                        value: money(
                          Math.abs(result.totals.monthlyMaintain - measured.monthlyAverage),
                        ),
                      },
                    )}
                  </p>
                )}
                {canApplyMeasured && (
                  <button
                    type="button"
                    onClick={applyMeasured}
                    className="mt-2.5 rounded-lg border border-[var(--engine-accent)]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--engine-accent)] transition hover:bg-[var(--engine-accent-soft)]"
                  >
                    {t("ownership.results.useMeasured")}
                  </button>
                )}
              </div>
            )}

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

            {/* Breakdown. Fechado por padrão: é conferência, não decisão, e
                aberto empurrava o resto da coluna para fora da tela. */}
            <details className="group rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("ownership.results.breakdown")}
                <ChevronDown
                  size={14}
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="mt-2 divide-y divide-[var(--engine-border)]">
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
            </details>

            {/* Financiamento */}
            {isFinance && financing && financing.principal > 0 && (
              <details className="group rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("ownership.results.financingTitle")}
                  <ChevronDown
                    size={14}
                    className="shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
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
              </details>
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
                {money(headlineCost)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("ownership.results.requiredIncome")}
              </p>
              <p className="text-lg font-extrabold leading-tight tabular-nums text-[var(--engine-text)]">
                {money(requiredIncome)}
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

/**
 * "Sobra ou não sobra" — o bloco que responde a pergunta que a regra de % da
 * renda nunca respondeu direito.
 *
 * Testada contra perfis reais, aquela regra reprova quem tem renda modesta e
 * contas baixas, que é justamente quem consegue pagar. Aqui a conta é direta:
 * renda menos as contas que continuam, menos o carro.
 *
 * É um campo só, e opcional. Decomposição por categoria não muda o resultado —
 * saber que R$ 1.200 são aluguel e R$ 800 mercado não move `renda − despesa −
 * carro` uma vírgula — e transformaria isto num formulário de orçamento
 * doméstico que ninguém preenche.
 */
function BudgetBlock({ t, money, monthlyCost, budget, currentCar, onChange, onCommit, lifeSituation }) {
  const income = Number(budget?.monthlyIncome) || 0;
  const expenses = Number(budget?.monthlyExpenses) || 0;
  const currentCarCost = currentCar?.insights?.monthlyAverage || 0;
  const replacing = Boolean(currentCar) && budget?.replacedCarId === String(currentCar.car.id);

  const verdict = assessAffordability({
    monthlyCost,
    monthlyIncome: income,
    monthlyExpenses: expenses,
    currentCarCost,
    replacingCurrentCar: replacing,
    lifeSituation,
  });

  const toneByLevel = {
    comfortable: comfortStyles.comfortable,
    tight: comfortStyles.warning,
    no_fit: comfortStyles.critical,
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
        <Wallet size={12} className="text-[var(--engine-accent)]" />
        {t("ownership.budget.title")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("ownership.budget.income")}>
          <input
            type="number"
            min="0"
            step="100"
            value={income || ""}
            placeholder="0"
            onChange={(event) => onChange({ monthlyIncome: Number(event.target.value) || 0 })}
            onBlur={onCommit}
            className={fieldClass}
          />
        </Field>
        <Field
          label={t("ownership.budget.expenses")}
          hint={t("ownership.budget.expensesHint")}
        >
          <input
            type="number"
            min="0"
            step="100"
            value={expenses || ""}
            placeholder="0"
            onChange={(event) => onChange({ monthlyExpenses: Number(event.target.value) || 0 })}
            onBlur={onCommit}
            className={fieldClass}
          />
        </Field>
      </div>

      {/* O gasto do carro atual já está dentro da despesa declarada. Somar o
          carro novo por cima conta carro duas vezes, e o erro é grande o
          bastante para virar o veredito. Só aparece quando existe medição —
          sem histórico, nem se menciona o assunto. */}
      {currentCarCost > 0 && expenses > 0 && (
        <div className="rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-3">
          <p className="text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
            {t("ownership.budget.currentCarNotice", {
              total: money(expenses),
              amount: money(currentCarCost),
              car: `${currentCar.car.brand} ${currentCar.car.model}`,
            })}
          </p>
          <div className="mt-2 flex gap-1.5">
            {[
              { key: "replace", active: replacing },
              { key: "keepBoth", active: !replacing },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange({
                    replacedCarId:
                      option.key === "replace" ? String(currentCar.car.id) : "",
                  });
                  // Um clique já é a decisão inteira, diferente de um número
                  // sendo digitado: não há por que esperar o campo perder foco.
                  window.setTimeout(onCommit, 0);
                }}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                  option.active
                    ? "bg-[var(--engine-accent)] text-white"
                    : "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)]"
                }`}
              >
                {t(`ownership.budget.${option.key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {verdict ? (
        <>
          <div
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${toneByLevel[verdict.level]}`}
          >
            <span>{t(`ownership.budget.verdict.${verdict.level}`)}</span>
            <span className="tabular-nums">{money(verdict.leftover)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--engine-text-subtle)]">
            {t("ownership.budget.math", {
              income: money(income),
              expenses: money(verdict.ongoingExpenses),
              car: money(monthlyCost),
            })}
          </p>
          {/* A regra de % não sumiu: virou detector de orçamento incompleto.
              Quando a folga aprova mas o carro come muito mais da renda do que
              o típico, quase sempre faltou uma conta na lista — então a tela
              pergunta, em vez de reprovar. */}
          {verdict.suspectIncompleteBudget && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-600 dark:text-amber-400">
              {t("ownership.budget.checkBudget", {
                pct: Math.round(verdict.committedPct * 100),
                typical: verdict.typicalSharePct,
              })}
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-[var(--engine-text-subtle)]">
          {t("ownership.budget.empty")}
        </p>
      )}
    </div>
  );
}
