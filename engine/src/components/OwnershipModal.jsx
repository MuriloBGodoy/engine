import { useMemo, useRef, useState } from "react";
// O detalhe perdeu os icones junto com os percentuais: com barra, rotulo e
// valor, o icone virava enfeite numa lista que precisa ser lida de cima a
// baixo. Ficaram os quatro que sao acao ou estado.
import { X, Save, Loader2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoTip } from "./InfoTip";
import {
  affordabilityLevers,
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
import { consumptionFor } from "../services/consumption";

// `min-h-11` são os 44px de alvo de toque. O campo tinha 40 e, com o rótulo
// colado nele, a coluna do formulário virava uma parede de retângulos.
const fieldClass =
  "w-full min-h-11 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-2.5 text-sm text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)] disabled:opacity-40";

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
  "ml-0.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--engine-text-muted)]";
const sectionTitleClass =
  "text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--engine-accent)]";

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? (
        <p className="ml-0.5 text-[11px] leading-relaxed text-[var(--engine-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Celula de apoio do slab: rotulo curto, o numero, e de onde ele vem. */
function SlabCell({ label, value, hint }) {
  return (
    <div className="bg-[var(--engine-slab-cell)] px-3.5 py-3">
      <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--engine-slab-fg-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11.5px] leading-snug text-[var(--engine-slab-fg-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Regua de conforto — tres zonas discretas, nao um gradiente.
 *
 * O motor devolve tres niveis e nada entre eles; um marcador deslizante
 * prometeria uma precisao que a conta nao tem. A zona ativa se distingue por
 * preenchimento (ver `.engine-slab-zone` no index.css): nenhuma cor nova
 * entrou no sistema, e o acento so aparece no "nao cabe", que é o unico lugar
 * onde o Engine ja usa vermelho — perigo.
 */
function ComfortRuler({ t, level, caption }) {
  return (
    <div className="mt-5">
      <div className="grid grid-cols-3 gap-1.5">
        {["comfortable", "tight", "no_fit"].map((zone) => (
          <div
            key={zone}
            className="engine-slab-zone"
            data-tone={zone}
            data-on={String(zone === level)}
          >
            {t(`ownership.answer.ruler.${zone}`)}
          </div>
        ))}
      </div>
      {caption ? (
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** A faixa de incerteza inteira, com o cenario central marcado nela. */
function RangeBar({ low, high, center, lowLabel, highLabel }) {
  const span = high - low;
  const dot = span > 0 ? Math.min(Math.max((center - low) / span, 0), 1) * 100 : 50;
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full bg-[var(--engine-slab-line)]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--engine-slab-line)] to-[var(--engine-slab-fg)] opacity-70" />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--engine-slab-fg)] shadow-[0_0_0_4px_var(--engine-slab-cell)]"
          style={{ left: `${dot}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[12px] text-[var(--engine-slab-fg-muted)]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/**
 * O convite — a acao principal da tela enquanto nao existe renda informada.
 *
 * Ele mora DENTRO do slab porque é o caminho para a resposta melhor, nao um
 * campo perdido no formulario. E guarda rascunho proprio de proposito:
 * escrevendo direto no `budget`, o veredito apareceria no meio da digitacao
 * (renda "5" e contas "3" ja bastam para o motor responder) e o segundo campo
 * sumiria da mao de quem estava preenchendo. So o botao publica.
 */
function Invite({ t, income, expenses, onSubmit, onSkip, onCancel }) {
  const [draftIncome, setDraftIncome] = useState(income ? String(income) : "");
  const [draftExpenses, setDraftExpenses] = useState(expenses ? String(expenses) : "");
  const ready = Number(draftIncome) > 0 && Number(draftExpenses) > 0;

  const inputClass =
    "h-12 w-full rounded-xl border border-[var(--engine-slab-line)] bg-[var(--engine-slab-cell)] px-3 text-base font-semibold text-[var(--engine-slab-fg)] outline-none placeholder:font-normal placeholder:text-[var(--engine-slab-fg-muted)] focus-visible:border-[var(--engine-slab-fg)]";
  const labelSlab =
    "mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--engine-slab-fg-muted)]";

  return (
    <form
      className="mt-5 rounded-2xl border border-[var(--engine-slab-line)] bg-[var(--engine-slab-raise)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onSubmit({
          monthlyIncome: Number(draftIncome) || 0,
          monthlyExpenses: Number(draftExpenses) || 0,
        });
      }}
    >
      <h4 className="text-[17px] font-bold text-[var(--engine-slab-fg)]">
        {t("ownership.invite.title")}
      </h4>
      <p className="mt-1 max-w-[54ch] text-[13px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
        {t("ownership.invite.body")}
      </p>
      <div className="mt-3.5 grid grid-cols-1 items-end gap-2.5 @[560px]:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className={labelSlab} htmlFor="engine-invite-income">
            {t("ownership.invite.income")}
          </label>
          <input
            id="engine-invite-income"
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            value={draftIncome}
            onChange={(event) => setDraftIncome(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelSlab} htmlFor="engine-invite-expenses">
            {t("ownership.invite.expenses")}
          </label>
          <input
            id="engine-invite-expenses"
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            value={draftExpenses}
            onChange={(event) => setDraftExpenses(event.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={!ready}
          className="h-12 rounded-xl bg-[var(--engine-slab-fg)] px-5 text-[15px] font-bold text-[var(--engine-slab-ink)] transition disabled:opacity-45"
        >
          {t("ownership.invite.cta")}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <button
          type="button"
          onClick={onCancel || onSkip}
          className="min-h-11 text-[12.5px] font-semibold text-[var(--engine-slab-fg)] underline underline-offset-4"
        >
          {onCancel ? t("common.cancel") : t("ownership.invite.skip")}
        </button>
        <p className="text-[12px] leading-snug text-[var(--engine-slab-fg-muted)]">
          {t("ownership.invite.privacy")}
        </p>
      </div>
    </form>
  );
}

/**
 * Alavanca: uma mudanca e o que ela tira da conta do mes.
 *
 * O botao APLICA o patch de verdade. Botao que anuncia um numero e nao faz
 * nada é promessa quebrada — e era metade do defeito do percentual: ele
 * descrevia o modelo sem oferecer saida nenhuma.
 *
 * `tradeoff` existe para o prazo maior: ele alivia o mes e encarece o total.
 * Vender isso com o mesmo peso das outras alavancas seria mentir por omissao,
 * entao a etiqueta fica escrita e a pilula do delta perde o preenchimento.
 */
function Lever({ label, note, delta, tradeoff, tradeoffTag, onApply }) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] px-3.5 py-3 text-left transition-colors hover:border-[var(--engine-border-strong)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug text-[var(--engine-text)]">
          {label}
        </span>
        {note ? (
          <span className="mt-1 block text-[12.5px] leading-snug text-[var(--engine-text-muted)]">
            {note}
          </span>
        ) : null}
        {tradeoff ? (
          <span className="mt-1.5 inline-block rounded-md border border-[var(--engine-border-strong)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--engine-text-muted)]">
            {tradeoffTag}
          </span>
        ) : null}
      </span>
      <span
        className={`shrink-0 rounded-lg px-3 py-2 font-display text-[15px] font-bold tabular-nums ${
          tradeoff
            ? "border border-[var(--engine-border-strong)] text-[var(--engine-text)]"
            : "bg-[var(--engine-text)] text-[var(--engine-bg)]"
        }`}
      >
        {delta}
      </span>
    </button>
  );
}

/**
 * Linha do detalhe: rotulo, valor em reais e uma barra.
 *
 * A barra é proporcional a MAIOR linha, nao ao total: ninguem soma barras de
 * cabeca, e assim nada some por ser pequeno (a barra fica curta, mas fica) —
 * que era o defeito da guarda de 0,5% do percentual.
 */
function DetailRow({ label, value, ratio, note }) {
  return (
    <div className="border-t border-[var(--engine-border)] py-2.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-[var(--engine-text)]">
          {label}
        </span>
        <span className="shrink-0 font-display text-[14.5px] font-bold tabular-nums text-[var(--engine-text)]">
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-[var(--engine-border)] bg-[var(--engine-surface-2)]">
        <span
          className="block h-full bg-[var(--engine-text)]"
          style={{ width: `${Math.min(Math.max(ratio * 100, 1.5), 100)}%` }}
        />
      </div>
      {note ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--engine-text-muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Bloco comum da coluna de decisao. */
function Bloco({ title, sub, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4 ${className}`}
    >
      {title ? (
        <h4 className="text-[14px] font-bold text-[var(--engine-text)]">{title}</h4>
      ) : null}
      {sub ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--engine-text-muted)]">
          {sub}
        </p>
      ) : null}
      <div className={title || sub ? "mt-3" : ""}>{children}</div>
    </div>
  );
}

/** Sanfona: o detalhe é consulta, e consulta comeca fechada. */
function Accordion({ title, aux, children, open = false }) {
  return (
    <details
      open={open}
      className="group rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
        <h4 className="flex-1 text-[14px] font-bold text-[var(--engine-text)]">{title}</h4>
        {aux ? (
          <span className="text-[12.5px] text-[var(--engine-text-muted)]">{aux}</span>
        ) : null}
        <ChevronDown
          size={15}
          className="shrink-0 text-[var(--engine-text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
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
  // O convite pode ser dispensado ("prefiro nao informar agora") e reaberto
  // ("mudar renda e contas"): sao os dois lados da mesma porta.
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const answerRef = useRef(null);
  const leversRef = useRef(null);
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

  // Consumo do PBE Veicular (INMETRO) para esta versão — síncrono, então é
  // valor derivado e não estado. Passa o carro inteiro porque marca, motor e
  // ano fazem parte da chave: `ONIX HATCH LTZ 1.0 12V TB Flex` casa com o Onix
  // 1.0 turbo da tabela, e um Strada 1.8 que a tabela de 2026 não tem devolve
  // null em vez do 1.3 que ela tem.
  //
  // O `fipeService.getConsumption` saiu daqui. Ele consultava o backend Java,
  // que TINHA PRECEDÊNCIA sobre a base local e serve o arquivo antigo — aquele
  // que dá diesel para o Onix. Em produção o backend não existe e a chamada
  // nunca respondia; em dev ela respondia e ganhava, então o dado falso vencia
  // o verdadeiro justamente na máquina de quem estava conferindo.
  const modelConsumption = useMemo(() => consumptionFor(car), [car]);

  // Renda e despesa são da pessoa e vivem em `settings`; a migração aceita o
  // valor antigo que ficou preso em `car.ownership.monthlyIncome`.
  const [budget, setBudget] = useState(() => ({
    ...(settings?.budget || {}),
    monthlyIncome:
      settings?.budget?.monthlyIncome || Number(car.ownership?.monthlyIncome) || 0,
  }));

  // Escrever a cada caractere transformava digitar "4500" em quatro escritas
  // no Firestore, e a cota diária do plano gratuito é contada em escritas. Com
  // o convite isso deixou de ser um problema de debounce e virou desenho: os
  // campos guardam rascunho local e a gravação acontece uma vez, no botão.
  //
  // O convite grava no MESMO lugar de sempre — `settings.budget` —, e grava
  // uma vez so: um clique é a decisao inteira, diferente de um numero sendo
  // digitado. Escreve direto o valor recebido porque o `budget` do closure
  // ainda é o anterior no instante do clique.
  const commitBudget = (patch) => {
    const next = { ...budget, ...patch };
    setBudget(next);
    engineDB
      .saveSettings({ ...settings, budget: { ...next, updatedAt: new Date().toISOString() } })
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

  const measuredPatch = useMemo(() => {
    if (!measured) return null;
    const patch = {};
    if (measured.kmPerMonth) patch.kmPerMonth = Math.round(measured.kmPerMonth);
    if (measured.consumption) {
      patch.userConsumption = Number(measured.consumption.kmPerLiter.toFixed(1));
    }
    return Object.keys(patch).length ? patch : null;
  }, [measured]);

  const applyMeasured = () => {
    if (!measuredPatch) return;
    setInputs((prev) => ({ ...prev, ...measuredPatch }));
    setTouched((prev) => {
      const next = new Set(prev);
      Object.keys(measuredPatch).forEach((field) => next.add(field));
      return next;
    });
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

  // ------------------------------- a resposta -------------------------------
  // O veredito subiu do meio da coluna para o topo da tela, entao a conta dele
  // é feita aqui: renda e contas sao da pessoa (vivem em `settings.budget`) e
  // o custo é o TETO da faixa, porque subestimar coloca alguem num contrato
  // que nao paga.
  const income = Number(budget.monthlyIncome) || 0;
  const declaredExpenses = Number(budget.monthlyExpenses) || 0;
  const currentCarCost = reference?.insights?.monthlyAverage || 0;
  const replacingCurrentCar =
    Boolean(reference) && budget?.replacedCarId === String(reference.car.id);

  const verdict = assessAffordability({
    monthlyCost: headlineCost,
    monthlyIncome: income,
    monthlyExpenses: declaredExpenses,
    currentCarCost,
    replacingCurrentCar,
    lifeSituation: inputs.lifeSituation,
  });

  const rangeIsWide = range.high - range.low >= 1;
  // O mesmo veredito no PISO da faixa: responde se o "nao cabe" depende de a
  // estimativa ter sido azarada ou se ele vale no cenario mais barato tambem.
  const leftoverAtLow = verdict ? verdict.disposable - range.low : 0;

  // As alavancas substituem o percentual do breakdown. Cada uma sabe o proprio
  // delta em reais E o patch que a aplica.
  const levers = useMemo(
    () => affordabilityLevers(car, effectiveInputs, { country, state }),
    [car, effectiveInputs, country, state],
  );

  const applyLever = (lever) => {
    setInputs((prev) => ({ ...prev, ...lever.patch }));
    setTouched((prev) => {
      const next = new Set(prev);
      Object.keys(lever.patch).forEach((field) => next.add(field));
      return next;
    });
  };

  // Quanto a faixa encolhe se a pessoa aceitar os km medidos. É o argumento do
  // botao: sem ele, "aplicar meus dados" é fé.
  const measuredRange = useMemo(() => {
    if (!measuredPatch || !unknownFields.length) return null;
    const applied = Object.keys(measuredPatch);
    const remaining = unknownFields.filter((field) => !applied.includes(field));
    if (remaining.length === unknownFields.length) return null;
    return estimateOwnershipRange(
      car,
      { ...effectiveInputs, ...measuredPatch },
      { country, state },
      remaining,
    );
  }, [car, effectiveInputs, measuredPatch, unknownFields, country, state]);

  const scrollTo = (ref) =>
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });

  const decimal = (value, digits = 2) =>
    value.toFixed(digits).replace(".", i18n.language.startsWith("en") ? "." : ",");

  const financing = result.financing;
  const rec = result.recommendations;
  // Meta de poupança: no financiado, o que falta para a entrada ideal;
  // à vista, o que falta para o valor cheio do carro.
  const savingsTarget =
    inputs.purchaseMode === "finance"
      ? rec.downPaymentGap
      : Math.max(result.value - (Number(car.savedValue) || 0), 0);
  const isFinance = inputs.purchaseMode === "finance";
  const defaultConsumption = DEFAULT_CONSUMPTION[inputs.fuelType];
  const carName = `${car.brand} ${car.model}`;

  // De onde vem o km/l que está valendo, para a tela dizer a verdade sobre a
  // procedência. São três coisas diferentes e elas não podem parecer a mesma:
  // o que a pessoa mediu, o que o INMETRO mediu nesta versão e o que é média
  // geral. O rótulo `Dated` existe porque a tabela é de 2026: num carro de
  // 2015 o número é da versão ATUAL do mesmo modelo, e isso precisa estar
  // escrito, não subentendido.
  const modelKmPerLiter = modelConsumption?.[inputs.fuelType];
  const consumptionSource = inputs.userConsumption
    ? "User"
    : !modelKmPerLiter
      ? "Default"
      : modelConsumption.dated
        ? "InmetroDated"
        : modelConsumption.match === "model"
          ? "InmetroModel"
          : "Inmetro";
  const shownConsumption = (
    inputs.userConsumption ||
    modelKmPerLiter ||
    defaultConsumption
  ).toFixed(1);

  // As linhas do detalhe, montadas aqui porque a barra de cada uma é
  // proporcional a MAIOR delas — e isso so se sabe com a lista pronta.
  const detailRows = [
    isFinance && result.monthly.financing > 0
      ? {
          key: "installment",
          label: t("ownership.results.installment"),
          value: result.monthly.financing,
          note: financing
            ? t("ownership.detail.installmentBasis", {
                months: financing.months,
                principal: money(financing.principal),
                rate: decimal(financing.monthlyRate * 100),
              })
            : "",
        }
      : null,
    {
      key: "insurance",
      label: t("ownership.results.insurance"),
      value: result.monthly.insurance,
      note:
        result.insurance?.basis === "thirdparty_forced"
          ? t("ownership.results.fullCoverageUnavailable", {
              age: result.insurance.fullCoverageMaxAge,
            })
          : "",
    },
    {
      key: "fuel",
      label: t("ownership.results.fuel"),
      value: result.monthly.fuel,
      note: t(`ownership.fields.consumption${consumptionSource}Hint`, {
        value: shownConsumption,
        year: modelConsumption?.tableYear,
      }),
    },
    {
      key: "tax",
      label:
        result.country === "BR" ? t("ownership.results.taxBR") : t("ownership.results.tax"),
      value: result.monthly.tax,
      note: "",
    },
    {
      key: "maintenance",
      label: t("ownership.results.maintenance"),
      value: result.monthly.maintenance,
      note: "",
    },
    {
      key: "licensing",
      label: t("ownership.results.licensing"),
      value: result.monthly.licensing,
      note: "",
    },
    result.monthly.parking > 0
      ? {
          key: "parking",
          label: t("ownership.results.parking"),
          value: result.monthly.parking,
          note: "",
        }
      : null,
    result.monthly.tolls > 0
      ? {
          key: "tolls",
          label: t("ownership.results.tolls"),
          value: result.monthly.tolls,
          note: "",
        }
      : null,
  ].filter(Boolean);
  const biggestLine = detailRows.reduce((max, row) => Math.max(max, row.value), 0);

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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--engine-text-muted)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Rolagem UNICA, tambem no desktop. As duas colunas rolavam sozinhas
            enquanto o resultado ficava ao lado do formulario; com a resposta
            ocupando a largura toda em cima, a mesma regra deixava a area de
            decisao espremida em alguns pixels no fim do modal. Quem mantem a
            resposta a vista agora é a barra fixa, que ficou visivel nos dois
            tamanhos. */}
        <div className="engine-modal-body engine-scroll @container grid content-start gap-5 px-4 py-5 sm:gap-6 sm:px-8 sm:py-6 lg:grid-cols-[1.32fr_1fr] lg:gap-x-8">
          {/* ======================== A RESPOSTA ==========================

              O slab é uma SUPERFICIE PROPRIA, e nao mais um cartao igual aos do
              formulario — era esse o defeito de origem: com a mesma casca dos
              campos, a resposta nao se anunciava como resposta.

              Ele tem DOIS estados de primeira classe. Com renda e contas, o
              veredito; sem elas, o custo com a faixa e o convite, que é a acao
              principal da tela. O segundo é o estado da primeira visita, nao
              uma excecao a tratar depois. */}
          <div ref={answerRef} className="engine-slab px-5 py-6 sm:px-7 lg:col-span-2">
            {verdict ? (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--engine-slab-fg-muted)]">
                  {t("ownership.answer.kicker")}
                </p>
                <h3
                  className={`engine-slab-verdict mt-2.5 ${
                    verdict.level === "no_fit" ? "text-[var(--engine-slab-accent)]" : ""
                  }`}
                >
                  {t(`ownership.answer.verdict.${verdict.level}`)}
                </h3>
                <p className="mt-2.5 max-w-[48ch] text-[15px] font-medium leading-snug">
                  {verdict.level === "no_fit"
                    ? t("ownership.answer.gap", {
                        value: money(Math.abs(verdict.leftover)),
                      })
                    : t("ownership.answer.left", { value: money(verdict.leftover) })}
                </p>

                <ComfortRuler
                  t={t}
                  level={verdict.level}
                  caption={t("ownership.answer.rulerCaption", {
                    pct: Math.round(verdict.committedPct * 100),
                    typical: verdict.typicalSharePct,
                  })}
                />

                <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--engine-slab-line)] bg-[var(--engine-slab-line)] @[420px]:grid-cols-2 @[700px]:grid-cols-3">
                  <SlabCell
                    label={t("ownership.answer.cellCost")}
                    value={money(result.totals.monthlyTotal)}
                    hint={
                      rangeIsWide
                        ? t("ownership.answer.cellCostHint", {
                            low: money(range.low),
                            high: money(range.high),
                          })
                        : t("ownership.results.perMonth")
                    }
                  />
                  <SlabCell
                    label={t("ownership.answer.cellLeft")}
                    value={money(verdict.disposable)}
                    hint={t("ownership.answer.cellLeftHint", {
                      income: money(income),
                      expenses: money(verdict.ongoingExpenses),
                    })}
                  />
                  <SlabCell
                    label={t("ownership.answer.cellKeep")}
                    value={money(result.totals.monthlyMaintain)}
                    hint={t("ownership.answer.cellKeepHint")}
                  />
                </div>

                {/* A conta escrita por extenso. Sem ela, o numero grande do
                    topo e a composicao la embaixo se contradizem para quem
                    soma — que é exatamente o publico de um simulador. */}
                <p className="mt-4 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
                  {t("ownership.answer.math", {
                    income: money(income),
                    expenses: money(verdict.ongoingExpenses),
                    car: money(headlineCost),
                  })}
                </p>
                {verdict.level === "no_fit" && rangeIsWide && leftoverAtLow < 0 ? (
                  <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
                    {t("ownership.answer.robust", {
                      low: money(range.low),
                      gap: money(Math.abs(leftoverAtLow)),
                    })}
                  </p>
                ) : null}

                {/* A regra de % nao sumiu: virou detector de orcamento
                    incompleto. Quando a folga aprova mas o carro come muito
                    mais da renda do que o tipico, quase sempre faltou uma
                    conta na lista — entao a tela pergunta, em vez de reprovar. */}
                {verdict.suspectIncompleteBudget ? (
                  <p className="mt-3 max-w-[62ch] rounded-xl border border-[var(--engine-slab-line)] bg-[var(--engine-slab-cell)] px-3 py-2 text-[12px] leading-relaxed text-[var(--engine-slab-fg)]">
                    {t("ownership.budget.checkBudget", {
                      pct: Math.round(verdict.committedPct * 100),
                      typical: verdict.typicalSharePct,
                    })}
                  </p>
                ) : null}

                {currentCarCost > 0 && declaredExpenses > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="min-w-[15rem] flex-1 text-[12px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
                      {t("ownership.budget.currentCarNotice", {
                        total: money(declaredExpenses),
                        amount: money(currentCarCost),
                        car: `${reference.car.brand} ${reference.car.model}`,
                      })}
                    </p>
                    {[
                      { key: "replace", active: replacingCurrentCar },
                      { key: "keepBoth", active: !replacingCurrentCar },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() =>
                          commitBudget({
                            replacedCarId:
                              option.key === "replace" ? String(reference.car.id) : "",
                          })
                        }
                        className={`min-h-10 shrink-0 rounded-lg px-2.5 text-[11px] font-extrabold uppercase tracking-wide transition ${
                          option.active
                            ? "bg-[var(--engine-slab-fg)] text-[var(--engine-slab-ink)]"
                            : "border border-[var(--engine-slab-line)] text-[var(--engine-slab-fg-muted)]"
                        }`}
                      >
                        {t(`ownership.budget.${option.key}`)}
                      </button>
                    ))}
                  </div>
                ) : null}

                {editingBudget ? (
                  <Invite
                    t={t}
                    income={income}
                    expenses={declaredExpenses}
                    onSubmit={(patch) => {
                      commitBudget(patch);
                      setEditingBudget(false);
                    }}
                    onCancel={() => setEditingBudget(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingBudget(true)}
                    className="mt-3 min-h-11 text-[12.5px] font-semibold text-[var(--engine-slab-fg)] underline underline-offset-4"
                  >
                    {t("ownership.invite.change")}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--engine-slab-fg-muted)]">
                  {t("ownership.answer.costKicker")}
                </p>
                {/* O numero grande é o cenario CENTRAL, e a faixa inteira
                    aparece embaixo dele. Antes o numero grande era o teto e a
                    composicao somava o central: quem conferia achava
                    contradicao. */}
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="engine-slab-number">
                    {money(result.totals.monthlyTotal)}
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--engine-slab-fg-muted)]">
                    {t("ownership.results.perMonth")}
                  </span>
                </div>
                {rangeIsWide ? (
                  <RangeBar
                    low={range.low}
                    high={range.high}
                    center={result.totals.monthlyTotal}
                    lowLabel={t("ownership.answer.low", { value: money(range.low) })}
                    highLabel={t("ownership.answer.high", { value: money(range.high) })}
                  />
                ) : null}
                <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--engine-slab-fg-muted)]">
                  {rangeIsWide
                    ? t("ownership.answer.unknownWhy", { count: unknownFields.length })
                    : t("ownership.answer.exact")}
                </p>
                {inviteDismissed ? (
                  <button
                    type="button"
                    onClick={() => setInviteDismissed(false)}
                    className="mt-4 min-h-11 text-[13px] font-bold text-[var(--engine-slab-fg)] underline underline-offset-4"
                  >
                    {t("ownership.invite.reopen")}
                  </button>
                ) : (
                  <Invite
                    t={t}
                    income={income}
                    expenses={declaredExpenses}
                    onSubmit={commitBudget}
                    onSkip={() => setInviteDismissed(true)}
                  />
                )}
              </>
            )}
          </div>


          {/* ===================== O QUE DECIDE ============================
              Alavancas, comparacao com o gasto real e — fechado — o detalhe.
              Nesta ordem: primeiro o que muda a resposta, depois o que a
              confere. */}
          <div className="@container space-y-4">
            {levers.length > 0 ? (
              <div ref={leversRef}>
                <Bloco
                  title={t(
                    verdict && verdict.level !== "no_fit"
                      ? "ownership.levers.titleCheaper"
                      : "ownership.levers.title",
                  )}
                  sub={t("ownership.levers.sub")}
                >
                  <div className="grid gap-2.5">
                    {levers.map((lever) => (
                      <Lever
                        key={lever.key}
                        label={
                          lever.key === "down"
                            ? t("ownership.levers.down", {
                                value: money(lever.params.target),
                              })
                            : lever.key === "months"
                              ? t("ownership.levers.months", {
                                  months: lever.params.months,
                                  from: lever.params.from,
                                })
                              : t(`ownership.levers.${lever.key}`)
                        }
                        note={
                          lever.key === "cash"
                            ? t("ownership.levers.cashNote", {
                                value: money(lever.params.value),
                              })
                            : lever.key === "thirdparty"
                              ? t("ownership.levers.thirdpartyNote")
                              : lever.key === "down"
                                ? t("ownership.levers.downNote", {
                                    have: money(lever.params.have),
                                    gap: money(lever.params.gap),
                                  })
                                : t("ownership.levers.monthsNote", {
                                    value: money(lever.params.extraInterest),
                                  })
                        }
                        delta={`−${money(lever.delta)}${t("ownership.levers.perMonth")}`}
                        tradeoff={lever.tradeoff}
                        tradeoffTag={t("ownership.levers.tradeoff")}
                        onApply={() => applyLever(lever)}
                      />
                    ))}
                  </div>
                </Bloco>
              </div>
            ) : null}

            {/* A comparacao com o gasto real é o diferencial do produto e
                estava em texto corrido no meio da rolagem. Usa
                `monthlyMaintain` dos dois lados — sem parcela e sem
                depreciacao —, que é o mesmo tipo de numero que a pessoa
                lancou. */}
            {measured ? (
              <Bloco title={t("ownership.results.realTitle")} sub={t("ownership.real.sub")}>
                <div className="grid grid-cols-1 items-stretch gap-2.5 @[560px]:grid-cols-[1fr_auto_1fr]">
                  <div className="rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--engine-text-muted)]">
                      {reference.isSelf
                        ? t("ownership.real.selfToday")
                        : t("ownership.real.today", {
                            car: `${reference.car.brand} ${reference.car.model}`,
                          })}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight text-[var(--engine-text)]">
                      {money(measured.monthlyAverage)}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-snug text-[var(--engine-text-muted)]">
                      {reference.isSelf
                        ? t("ownership.real.selfHint")
                        : t("ownership.real.todayHint", {
                            count: measured.expenses.length,
                          })}
                    </p>
                  </div>
                  <p className="flex items-center font-display text-[14px] font-bold text-[var(--engine-accent)] @[560px]:justify-center">
                    {Math.abs(result.totals.monthlyMaintain - measured.monthlyAverage) < 1
                      ? t("ownership.real.same")
                      : t(
                          result.totals.monthlyMaintain > measured.monthlyAverage
                            ? "ownership.real.more"
                            : "ownership.real.less",
                          {
                            value: money(
                              Math.abs(
                                result.totals.monthlyMaintain - measured.monthlyAverage,
                              ),
                            ),
                          },
                        )}
                  </p>
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--engine-accent)_34%,transparent)] bg-[var(--engine-accent-soft)] px-3.5 py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--engine-text-muted)]">
                      {reference.isSelf
                        ? t("ownership.real.selfTarget")
                        : t("ownership.real.target", { car: carName })}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight text-[var(--engine-text)]">
                      {money(result.totals.monthlyMaintain)}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-snug text-[var(--engine-text-muted)]">
                      {t("ownership.real.targetHint")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
                  {t("ownership.real.basis")}
                </p>
              </Bloco>
            ) : null}

            {/* ------------------------ O detalhe -------------------------
                Sem percentual: barra proporcional a maior linha, valor em
                reais e a procedencia escrita. A depreciacao ficou FORA da
                soma, em caixa tracejada, porque nao sai do bolso — misturar
                as duas coisas era o defeito de origem do bloco. */}
            <Accordion
              title={t("ownership.results.breakdown")}
              aux={t("ownership.detail.lines", { count: detailRows.length })}
            >
              <div>
                {detailRows.map((row) => (
                  <DetailRow
                    key={row.key}
                    label={row.label}
                    value={money(row.value)}
                    ratio={biggestLine > 0 ? row.value / biggestLine : 0}
                    note={row.note}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-[var(--engine-border-strong)] pt-3">
                <span className="text-[13px] font-bold text-[var(--engine-text)]">
                  {t("ownership.detail.total")}
                </span>
                <span className="font-display text-lg font-bold tabular-nums tracking-tight text-[var(--engine-text)]">
                  {money(result.totals.monthlyTotal)}
                </span>
              </div>
              <div className="mt-3.5 rounded-xl border border-dashed border-[var(--engine-border-strong)] bg-[var(--engine-surface-2)] px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-[var(--engine-text)]">
                    {t("ownership.results.depreciation")}
                  </span>
                  <span className="shrink-0 font-display text-[14.5px] font-bold tabular-nums text-[var(--engine-text)]">
                    {money(result.monthly.depreciation)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-dashed border-[var(--engine-border-strong)]">
                  <span
                    className="block h-full bg-[repeating-linear-gradient(90deg,var(--engine-border-strong)_0_6px,transparent_6px_11px)]"
                    style={{
                      width: `${
                        biggestLine > 0
                          ? Math.min((result.monthly.depreciation / biggestLine) * 100, 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--engine-text-muted)]">
                  <span className="mr-1.5 inline-block rounded-md border border-[var(--engine-border-strong)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                    {t("ownership.detail.outside")}
                  </span>
                  {t("ownership.results.depreciationNote")}
                </p>
              </div>
            </Accordion>

            {isFinance && financing && financing.principal > 0 ? (
              <Accordion title={t("ownership.results.financingTitle")}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <span className="text-[var(--engine-text-muted)]">
                    {t("ownership.results.downPayment")}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(financing.downPayment)} ({(financing.downPaymentPct * 100).toFixed(0)}%)
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
              </Accordion>
            ) : null}

            {/* O plano de conquista continua inteiro, so parou de competir com
                a resposta: é consulta de quem ja aceitou o numero. */}
            <Accordion title={t("ownership.results.recTitle")}>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[var(--engine-text-muted)]">
                    {t("ownership.results.idealDown")}
                    <InfoTip text={t("ownership.tips.idealDown")} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(rec.recommendedDownPayment)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--engine-text-muted)]">
                    {rec.downPaymentGap > 0
                      ? t("ownership.results.downGap")
                      : t("ownership.results.downReady")}
                  </span>
                  {rec.downPaymentGap > 0 ? (
                    <span className="font-semibold tabular-nums text-[var(--engine-accent)]">
                      {money(rec.downPaymentGap)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[var(--engine-text-muted)]">
                    {t("ownership.results.emergencyFund")}
                    <InfoTip text={t("ownership.tips.emergencyFund")} />
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--engine-text)]">
                    {money(rec.emergencyFund)}
                  </span>
                </div>
              </div>
              {savingsTarget > 0 ? (
                <div className="mt-3 border-t border-[var(--engine-border)] pt-3">
                  <p className="text-[12.5px] font-semibold text-[var(--engine-text)]">
                    {t("ownership.results.savePlanTitle", { amount: money(savingsTarget) })}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[6, 12, 24].map((months) => (
                      <div
                        key={months}
                        className="rounded-xl bg-[var(--engine-surface-2)] px-2 py-2 text-center"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--engine-text-muted)]">
                          {t("ownership.results.savePlanMonths", { months })}
                        </p>
                        <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-[var(--engine-text)]">
                          {money(savingsTarget / months)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Accordion>

            <p className="text-[11px] leading-relaxed text-[var(--engine-text-muted)]">
              {t("ownership.disclaimer")}
            </p>
          </div>

          {/* ==================== O QUE AJUSTA =========================
              O formulario nao sumiu: deixou de ser a porta de entrada. Ele
              é a segunda coluna no desktop e vem depois da resposta no
              celular. */}
          {/* ------------------------------ Formulário ----------------------- */}
          <div className="@container space-y-6">
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

                <section className="space-y-3.5">
                  <h3 className={sectionTitleClass}>{t("ownership.fields.kmPerMonth")}</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {KM_BANDS.map((band) => (
                      <button
                        key={band.key}
                        type="button"
                        onClick={() => set("kmPerMonth", band.value)}
                        className={`rounded-xl border px-3.5 py-3 text-left transition ${
                          Number(inputs.kmPerMonth) === band.value
                            ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)]"
                            : "border-[var(--engine-border)] hover:border-[var(--engine-accent)]"
                        }`}
                      >
                        <span className="block text-[12px] font-bold text-[var(--engine-text)]">
                          {t(`ownership.kmBands.${band.key}`)}
                        </span>
                        <span className="block text-[11px] tabular-nums text-[var(--engine-text-muted)]">
                          ~{band.value.toLocaleString(i18n.language)} km
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3.5">
                  <h3 className={sectionTitleClass}>{t("ownership.fields.coverage")}</h3>
                  <div className="grid grid-cols-3 gap-2.5">
                    {COVERAGE_TYPES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => set("coverage", option)}
                        className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-[11px] font-bold leading-tight transition ${
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
            <section className="space-y-3.5">
              <h3 className={sectionTitleClass}>{t("ownership.sections.location")}</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
            <section className="space-y-3.5">
              <h3 className={sectionTitleClass}>{t("ownership.sections.usage")}</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
                      <InfoTip
                        text={t(`ownership.fields.consumption${consumptionSource}`, {
                          year: modelConsumption?.tableYear,
                        })}
                      />
                    </div>
                  }
                  hint={t(`ownership.fields.consumption${consumptionSource}Hint`, {
                    value: shownConsumption,
                    year: modelConsumption?.tableYear,
                  })}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder={t("ownership.fields.consumptionPlaceholder", {
                      value: shownConsumption,
                    })}
                    value={inputs.userConsumption || ""}
                    onChange={(e) => set("userConsumption", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>
            </section>

            {/* Perfil do condutor */}
            <section className="space-y-3.5">
              <h3 className={sectionTitleClass}>{t("ownership.sections.driver")}</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
            <section className="space-y-3.5">
              <h3 className={sectionTitleClass}>{t("ownership.sections.purchase")}</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {["finance", "cash"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("purchaseMode", mode)}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
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
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
            <section className="space-y-3.5">
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
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field
                  label={t("ownership.fields.incomeShare")}
                  hint={t("ownership.fields.incomeShareHint", {
                    pct: LIFE_SITUATIONS[inputs.lifeSituation].suggestedShare,
                  })}
                >
                  <input
                    type="number"
                    min="1"
                    max="100"
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

            {/* ---------------------- Estreitar a faixa --------------------
                O que mais reduz a incerteza é oferecido DEPOIS da resposta, em
                vez de virar mais um campo antes dela. */}
            {canApplyMeasured && measuredPatch ? (
              <Bloco
                title={t("ownership.precision.title")}
                sub={t("ownership.precision.sub")}
                className="bg-[var(--engine-surface-2)]"
              >
                <Lever
                  label={
                    measuredPatch.kmPerMonth
                      ? t("ownership.precision.km", {
                          km: measuredPatch.kmPerMonth.toLocaleString(i18n.language),
                        })
                      : t("ownership.results.useMeasured")
                  }
                  note={
                    measuredRange && range.high - range.low > measuredRange.high - measuredRange.low
                      ? t("ownership.precision.kmNote", {
                          from: money(range.high - range.low),
                          to: money(measuredRange.high - measuredRange.low),
                        })
                      : t("ownership.precision.kmNoteSimple")
                  }
                  delta={t("ownership.precision.apply")}
                  onApply={applyMeasured}
                />
              </Bloco>
            ) : null}

            {/* ------------------- Renda necessaria ------------------------
                Ela responde "quanto eu precisaria ganhar", que é pergunta
                legitima — mas nao é A pergunta. Era o maior numero da tela e
                desceu para o ajuste fino, junto do % de renda que a move. */}
            <Accordion title={t("ownership.answer.incomeTitle")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[13px] text-[var(--engine-text-muted)]">
                  {t("ownership.results.requiredIncome")}
                  <InfoTip text={t("ownership.tips.requiredIncome")} align="right" />
                </span>
                <span className="font-display text-lg font-bold tabular-nums tracking-tight text-[var(--engine-text)]">
                  {money(requiredIncome)}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--engine-text-muted)]">
                {t("ownership.results.requiredIncomeHint", { pct: sharePct })}
              </p>

              <div className="mt-3 border-t border-[var(--engine-border)] pt-3">
                <p className="text-[11px] font-semibold text-[var(--engine-text-muted)]">
                  {t("ownership.results.shareLabel")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    inputMode="numeric"
                    value={sharePct}
                    onChange={(e) => set("incomeSharePct", e.target.value)}
                    className="h-11 w-16 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-2 text-center text-base font-bold tabular-nums text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)]"
                  />
                  <span className="text-sm font-bold text-[var(--engine-text-muted)]">%</span>
                  {[15, 20, 25, 30, 35].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => set("incomeSharePct", pct)}
                      className={`h-11 min-w-11 rounded-lg border px-2.5 text-[12px] font-bold tabular-nums transition-colors ${
                        sharePct === pct
                          ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                          : "border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)]"
                      }`}
                    >
                      {pct}
                    </button>
                  ))}
                </div>
                {sharePct > (LIFE_SITUATIONS[inputs.lifeSituation]?.warning || 0.3) * 100 ? (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-amber-600 dark:text-amber-400">
                    {t("ownership.results.shareWarning", {
                      pct: sharePct,
                      limit: Math.round(
                        (LIFE_SITUATIONS[inputs.lifeSituation]?.warning || 0.3) * 100,
                      ),
                    })}
                  </p>
                ) : null}
              </div>

              {result.value > 0 ? (
                <div className="mt-3 border-t border-[var(--engine-border)] pt-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--engine-text-muted)]">
                    {t("ownership.results.compareTitle")}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--engine-accent)]">
                        {t(`ownership.purchaseOptions.${inputs.purchaseMode}`)}
                      </p>
                      <p className="font-display text-base font-bold tabular-nums text-[var(--engine-text)]">
                        {money(requiredIncome)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--engine-text-muted)]">
                        {t(`ownership.purchaseOptions.${altPurchase}`)}
                      </p>
                      <p className="font-display text-base font-bold tabular-nums text-[var(--engine-text-muted)]">
                        {money(altRequiredIncome)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--engine-text-muted)]">
                    {t("ownership.results.compareHint", {
                      times: decimal(
                        Math.max(requiredIncome, altRequiredIncome) /
                          Math.max(Math.min(requiredIncome, altRequiredIncome), 1),
                        1,
                      ),
                    })}
                  </p>
                </div>
              ) : null}
            </Accordion>
          </div>
        </div>

        {/* ========================= A BARRA FIXA ========================
            Ela repete a resposta e oferece A acao certa para ela. Antes o
            botao primario era "salvar simulacao" em qualquer estado — arquivar
            antes de decidir. Agora salvar so vira primario depois do veredito
            que aprova; enquanto nao cabe, o caminho é ver o que faria caber, e
            enquanto nao ha renda, é informar a renda. */}
        <div className="engine-safe-bottom shrink-0 border-t border-[var(--engine-border)] bg-[var(--engine-elevated)] px-4 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
              {verdict ? (
                <>
                  <p className="text-[13.5px] font-bold leading-tight text-[var(--engine-text)]">
                    {t(`ownership.answer.verdict.${verdict.level}`)}
                  </p>
                  <p className="text-[12px] leading-tight text-[var(--engine-text-muted)]">
                    {verdict.level === "no_fit"
                      ? t("ownership.answer.footGap", {
                          value: money(Math.abs(verdict.leftover)),
                        })
                      : t("ownership.answer.footLeft", { value: money(verdict.leftover) })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-[17px] font-bold leading-tight tabular-nums text-[var(--engine-text)]">
                    {money(result.totals.monthlyTotal)}
                  </p>
                  <p className="text-[12px] leading-tight text-[var(--engine-text-muted)]">
                    {rangeIsWide
                      ? t("ownership.answer.footRange", {
                          low: money(range.low),
                          high: money(range.high),
                        })
                      : t("ownership.results.perMonth")}
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14.5px] font-bold tracking-tight transition-colors disabled:opacity-50 sm:flex-none ${
                verdict && verdict.level === "comfortable"
                  ? "bg-[var(--engine-accent)] text-white hover:brightness-95"
                  : "border border-[var(--engine-border-strong)] text-[var(--engine-text)] hover:border-[var(--engine-accent)]"
              }`}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {/* No celular a barra tem duas acoes e o rotulo longo quebrava em
                  duas linhas; o curto diz a mesma coisa com o icone ao lado. */}
              <span className="sm:hidden">{t("common.save")}</span>
              <span className="hidden sm:inline">{t("ownership.save")}</span>
            </button>

            {!verdict ? (
              <button
                type="button"
                onClick={() => {
                  setInviteDismissed(false);
                  scrollTo(answerRef);
                }}
                className="min-h-12 flex-1 rounded-xl bg-[var(--engine-accent)] px-4 text-[14.5px] font-bold tracking-tight text-white transition-colors hover:brightness-95 sm:flex-none"
              >
                {t("ownership.invite.cta")}
              </button>
            ) : verdict.level !== "comfortable" && levers.length > 0 ? (
              <button
                type="button"
                onClick={() => scrollTo(leversRef)}
                className="min-h-12 flex-1 rounded-xl bg-[var(--engine-accent)] px-4 text-[14.5px] font-bold tracking-tight text-white transition-colors hover:brightness-95 sm:flex-none"
              >
                {t("ownership.answer.fix")}
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}
