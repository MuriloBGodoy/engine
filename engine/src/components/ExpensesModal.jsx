import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Fuel, Gauge, Loader2, Receipt, Sparkles, Trash2, X } from "lucide-react";
import { engineDB } from "../services/db";
import { EXPENSE_CATEGORIES, expenseInsights } from "../services/expenses";
import { trackEvent } from "../services/observability";

const today = () => new Date().toISOString().slice(0, 10);

/** Categorias em que faz sentido oferecer um prestador logo depois do lançamento. */
const SERVICE_CATEGORIES = ["cleaning", "maintenance", "tires"];

const emptyForm = () => ({
  category: "fuel",
  amount: "",
  date: today(),
  odometer: "",
  liters: "",
  note: "",
});

/**
 * Registro de gasto do carro que a pessoa já tem.
 *
 * O simulador de posse responde "quanto custaria"; isto responde "quanto está
 * custando". Por isso mora no carro `owned` e não na meta: só faz sentido
 * lançar abastecimento de um carro que existe na garagem.
 *
 * O resumo vem antes do formulário de propósito. Quem abre pela segunda vez
 * quer ver o número, não digitar — e ver o número é o que faz voltar.
 */
export function ExpensesModal({ car, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastCategory, setLastCategory] = useState("");

  const insights = useMemo(() => expenseInsights(car || {}), [car]);

  if (!car) return null;

  const money = (value, digits = 0) =>
    new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: digits,
    }).format(value || 0);

  const decimal = (value, digits = 1) =>
    new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value || 0);

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const parseAmount = (value) =>
    Number(String(value).replace(/\./g, "").replace(",", "."));

  const submit = async (event) => {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    if (!amount || amount <= 0) {
      setError(t("expenses.invalidAmount"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await engineDB.addCarExpense(car.id, {
        category: form.category,
        amount,
        date: form.date,
        odometer: parseAmount(form.odometer) || 0,
        liters: parseAmount(form.liters) || 0,
        note: form.note,
      });
      trackEvent("gasto_registrado", { categoria: form.category, carId: car.id });
      setLastCategory(form.category);
      onSaved?.(updated);
      setForm((current) => ({ ...emptyForm(), category: current.category }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (expenseId) => {
    setSaving(true);
    try {
      const updated = await engineDB.removeCarExpense(car.id, expenseId);
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  };

  const isFuel = form.category === "fuel";
  const showServiceHint = SERVICE_CATEGORIES.includes(lastCategory);

  return (
    <div className="engine-modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("expenses.title")}
        className="engine-modal-panel engine-pop sm:max-w-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--engine-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]">
              <Receipt size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-[var(--engine-text)]">
                {t("expenses.title")}
              </h2>
              <p className="truncate text-xs text-[var(--engine-text-muted)]">
                {car.brand} {car.model}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-5 py-5">
          {/* Resumo: só aparece o que os dados sustentam. Média mensal exige 30
              dias de histórico; consumo real exige dois abastecimentos com
              odômetro. Antes disso, mostrar o campo vazio seria pior que não
              mostrar. */}
          {insights.expenses.length > 0 && (
            <div className="grid gap-2 min-[420px]:grid-cols-3">
              <SummaryTile
                label={
                  insights.monthlyAverage
                    ? t("expenses.monthlyAverage")
                    : t("expenses.totalSpent")
                }
                value={money(insights.monthlyAverage ?? insights.total)}
                hint={
                  insights.monthlyAverage
                    ? null
                    : t("expenses.needMoreHistory")
                }
              />
              <SummaryTile
                icon={Fuel}
                label={t("expenses.realConsumption")}
                value={
                  insights.consumption
                    ? t("expenses.kmPerLiter", {
                        value: decimal(insights.consumption.kmPerLiter),
                      })
                    : "—"
                }
                hint={insights.consumption ? null : t("expenses.needTwoFills")}
              />
              <SummaryTile
                icon={Gauge}
                label={t("expenses.costPerKm")}
                value={insights.costPerKm ? money(insights.costPerKm, 2) : "—"}
                hint={insights.costPerKm ? null : t("expenses.needOdometer")}
              />
            </div>
          )}

          {insights.byCategory.length > 1 && (
            <div className="space-y-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)]">
                {t("expenses.whereItGoes")}
              </p>
              {insights.byCategory.slice(0, 4).map((row) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--engine-text)]">
                      {t(`expenses.category.${row.category}`)}
                    </span>
                    <span className="tabular-nums text-[var(--engine-text-muted)]">
                      {money(row.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--engine-surface)]">
                    <div
                      className="h-full rounded-full bg-[var(--engine-accent)]"
                      style={{ width: `${Math.round(row.share * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, category }))}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                    form.category === category
                      ? "bg-[var(--engine-accent)] text-white"
                      : "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
                  }`}
                >
                  {t(`expenses.category.${category}`)}
                </button>
              ))}
            </div>

            <div className="grid gap-3 min-[420px]:grid-cols-2">
              <Field label={t("expenses.amount")}>
                <input
                  value={form.amount}
                  onChange={setField("amount")}
                  inputMode="decimal"
                  placeholder="250"
                  className={inputClass}
                />
              </Field>
              <Field label={t("expenses.date")}>
                <input
                  type="date"
                  value={form.date}
                  max={today()}
                  onChange={setField("date")}
                  className={inputClass}
                />
              </Field>
              <Field
                label={t("expenses.odometer")}
                hint={t("expenses.odometerHint")}
              >
                <input
                  value={form.odometer}
                  onChange={setField("odometer")}
                  inputMode="numeric"
                  placeholder="87500"
                  className={inputClass}
                />
              </Field>
              {isFuel && (
                <Field label={t("expenses.liters")}>
                  <input
                    value={form.liters}
                    onChange={setField("liters")}
                    inputMode="decimal"
                    placeholder="38"
                    className={inputClass}
                  />
                </Field>
              )}
            </div>

            <Field label={t("expenses.note")}>
              <input
                value={form.note}
                onChange={setField("note")}
                placeholder={t("expenses.notePlaceholder")}
                className={inputClass}
              />
            </Field>

            {error && (
              <p className="text-xs font-semibold text-[var(--engine-accent)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-5 text-xs font-black uppercase tracking-widest text-white transition hover:brightness-95 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {t("expenses.save")}
            </button>
          </form>

          {/* Quem acabou de lançar uma lavagem ou uma revisão é exatamente quem
              procura prestador. É o encontro entre a frequência de uso e a
              receita — e por isso o convite aparece aqui, e não numa aba. */}
          {showServiceHint && (
            <Link
              to="/services"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-[var(--engine-accent)]/30 bg-[var(--engine-accent-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--engine-accent)] transition hover:border-[var(--engine-accent)]"
            >
              <Sparkles size={14} className="shrink-0" />
              {t("expenses.serviceHint")}
            </Link>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)]">
              {t("expenses.historyTitle")}
            </p>

            {insights.expenses.length ? (
              <ul className="space-y-1.5">
                {insights.expenses.slice(0, 30).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--engine-border)] px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-[var(--engine-text)]">
                        {t(`expenses.category.${entry.category}`)}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </span>
                      <span className="block text-[11px] text-[var(--engine-text-muted)]">
                        {new Date(`${entry.date}T12:00:00`).toLocaleDateString(i18n.language)}
                        {entry.odometer
                          ? ` · ${new Intl.NumberFormat(i18n.language).format(entry.odometer)} km`
                          : ""}
                        {entry.liters ? ` · ${decimal(entry.liters)} L` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-black tabular-nums text-[var(--engine-text)]">
                        {money(entry.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(entry.id)}
                        disabled={saving}
                        aria-label={t("common.delete")}
                        className="text-[var(--engine-text-subtle)] transition hover:text-[var(--engine-accent)] disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--engine-text-muted)]">
                {t("expenses.historyEmpty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-2.5 text-sm text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)]";

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-muted)]">
        {label}
        {hint && (
          <span className="ml-1 font-medium normal-case tracking-normal text-[var(--engine-text-subtle)]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function SummaryTile({ icon, label, value, hint }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)]">
        {Icon && <Icon size={12} className="text-[var(--engine-accent)]" />}
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-extrabold tabular-nums text-[var(--engine-text)]">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] leading-tight text-[var(--engine-text-subtle)]">
          {hint}
        </p>
      )}
    </div>
  );
}
