import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Gauge, Pencil, Sparkles, Split, Wrench } from "lucide-react";
import { SPEC_STATUS } from "../../services/vehicleSpecs";
import { CONFIDENCE } from "../../services/fipeVersion";
import { SPEC_ISSUE, SPEC_LAYER } from "../../services/carSpecSheet";
import {
  basisLabel,
  cellPair,
  cellText,
  fieldLabel,
  formatNumber,
  fuelBasisLabel,
  holdLabel,
  issueLabel,
  modLabel,
  originLabel,
  stageLabel,
} from "./labels";

/**
 * Ordem em que os campos disputam as quatro celulas da grade.
 *
 * DECISAO (delegada pelo Murilo): grade POR PRIORIDADE, nao grade fixa com
 * buracos. O motivo e um numero, nao gosto — a cobertura medida pelo Brian da
 * potencia de fabrica em 10 de 26 versoes de volume (38%), e desempenho em 4
 * de 26. Uma grade fixa mostraria, no carro mediano, duas celulas preenchidas
 * e quatro vazias: exatamente o "N/D" do iCarros que esta feature existe para
 * nao repetir. A grade se preenche com o que EXISTE, na ordem abaixo, e o que
 * nao existe vai para "o que nao sabemos" com o motivo escrito.
 */
const GRID_PRIORITY = [
  "torque",
  "engine",
  "transmission",
  "fuel",
  "accel0to100S",
  "topSpeedKmh",
  "drivetrain",
  "bodyStyle",
  "doors",
  "engineFamily",
];

/** Campos que a grade compoe numa celula so ("1.0 12V turbo"). */
const ENGINE_PARTS = ["displacement", "valves", "aspiration"];

const isValue = (cell) => cell?.status === SPEC_STATUS.VALUE;

const biggest = (cell) => {
  if (!cell) return null;
  if (cell.pair) return Math.max(cell.pair.ethanol, cell.pair.gasoline);
  return cell.value ?? null;
};

/**
 * A celula sintetica "Motor". Existe porque cilindrada sozinha ("1.0") e uma
 * celula pobre, e porque e assim que a pessoa fala do proprio carro: ninguem
 * diz "meu motor tem 12 valvulas", diz "e o 1.0 12V".
 */
const buildEngineCell = (t, language, fields) => {
  const parts = ENGINE_PARTS.map((id) => fields[id])
    .filter(isValue)
    .map((cell) => cellText(t, language, cell))
    .filter(Boolean);
  if (!parts.length) return null;

  return {
    id: "engine",
    status: SPEC_STATUS.VALUE,
    text: parts.join(" "),
    // A confianca da celula composta e a PIOR das partes: se a aspiracao foi
    // inferida, o "1.0 12V turbo" inteiro e inferido. Herdar a melhor seria
    // lavar a inferencia com a certeza da cilindrada.
    inferred: ENGINE_PARTS.map((id) => fields[id]).some(
      (cell) => isValue(cell) && cell.confidence === CONFIDENCE.INFERRED,
    ),
  };
};

/** Etiqueta de procedencia. Quatro valores, e nenhum deles e uma textura. */
function OriginTag({ tag }) {
  const { t } = useTranslation();
  // Vermelho so no que o dono afirma sobre o exemplar dele: modificado e
  // medido mudam o que o carro E. Declarado apenas preenche um buraco da
  // fabrica, entao usa a mesma moldura em tracejado, sem cor.
  const claim = tag === "modificado" || tag === "medido";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] ${
        claim
          ? "border-[var(--engine-accent)]/45 text-[var(--engine-accent)]"
          : "border-[var(--engine-border-strong)] text-[var(--engine-text-muted)]"
      } ${tag === "declarado" ? "border-dashed" : ""}`}
    >
      {originLabel(t, tag)}
    </span>
  );
}

/** Os dois lados do par flex, com o rotulo no meio. Referencia 07 da pesquisa. */
function FlexPair({ pair, label }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="min-w-0 text-center">
        <p className="spec-number text-[clamp(2.1rem,10vw,3.3rem)]">{pair.ethanol}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--engine-text-muted)]">
          {pair.unit} · {t("specSheet.fuelBasis.ethanol")}
        </p>
      </div>
      <div className="px-1 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--engine-text-muted)]">
          {label}
        </p>
        <span aria-hidden="true" className="my-2 block h-px bg-[var(--engine-border-strong)]" />
      </div>
      <div className="min-w-0 text-center">
        <p className="spec-number text-[clamp(2.1rem,10vw,3.3rem)]">{pair.gasoline}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--engine-text-muted)]">
          {pair.unit} · {t("specSheet.fuelBasis.gasoline")}
        </p>
      </div>
    </div>
  );
}

function SingleNumber({ value, unit, label, sub }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--engine-text-muted)]">
        {label}
      </p>
      <p className="spec-number mt-2 text-[clamp(2.8rem,14vw,4.2rem)]">
        {value}
        {unit ? (
          <span className="ml-1.5 align-baseline text-base font-bold text-[var(--engine-text-muted)]">
            {unit}
          </span>
        ) : null}
      </p>
      {sub ? (
        <p className="mt-1.5 text-[11px] font-semibold text-[var(--engine-text-muted)]">{sub}</p>
      ) : null}
    </div>
  );
}

/**
 * O heroi.
 *
 * A ordem dos estados E a decisao de projeto desta rodada. O caso que o
 * briefing tratava como central — "de fabrica 150 -> hoje 220" — so existe
 * quando HA numero de fabrica, e ele falta em ~62% dos carros reais. Entao o
 * heroi foi desenhado do estado majoritario para o minoritario:
 *
 *   ausente — nao ha fonte nenhuma. No carro da pessoa isso nao e um buraco, e
 *             o convite: so ela sabe. No carro de outra pessoa o heroi
 *             simplesmente nao existe, e a grade sobe para o topo.
 *   retido  — o parser se absteve. Hachura + a acao que destrava.
 *   valor   — o numero grande, com o par flex simetrico.
 *   delta   — modificado sobre um valor de fabrica: os dois numeros e a seta.
 */
function Hero({ cell, resolved, canEdit, onEdit, onCorrectVersion }) {
  const { t, i18n } = useTranslation();
  const label = fieldLabel(t, "powerCv");

  if (!cell || cell.status === SPEC_STATUS.ABSENT) {
    if (!canEdit) return null;
    return (
      <div className="border-b border-[var(--engine-border)] bg-[var(--engine-elevated)] px-4 py-6 text-center sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--engine-text-muted)]">
          {label}
        </p>
        <p className="mx-auto mt-3 max-w-[32ch] font-display text-lg font-extrabold leading-snug text-[var(--engine-text)]">
          {t("specSheet.hero.onlyYouKnow")}
        </p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
          {t("specSheet.hero.onlyYouKnowWhy")}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--engine-accent)] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-[var(--engine-accent)] transition hover:bg-[var(--engine-accent-soft)]"
        >
          <Pencil size={14} aria-hidden="true" />
          {t("specSheet.hero.declarePower")}
        </button>
      </div>
    );
  }

  if (cell.status === SPEC_STATUS.HELD) {
    return (
      <div className="spec-hatch border-b border-[var(--engine-border)] px-4 py-6 text-center sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--engine-text-muted)]">
          {label}
        </p>
        <p className="mx-auto mt-3 max-w-[32ch] font-display text-lg font-extrabold leading-snug text-[var(--engine-text)]">
          {t("specSheet.hero.cannotAffirm")}
        </p>
        <p className="mx-auto mt-1.5 max-w-[44ch] text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
          {holdLabel(t, cell.reason)}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={onCorrectVersion}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--engine-accent)] bg-[var(--engine-surface)] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-[var(--engine-accent)] transition hover:bg-[var(--engine-accent-soft)]"
          >
            <Sparkles size={14} aria-hidden="true" />
            {t("specSheet.hero.unlockAction")}
          </button>
        ) : null}
      </div>
    );
  }

  const pair = cellPair(i18n.language, cell);
  const tag = resolved.tags[cell.id];
  // A seta so existe para camada 3. Valor declarado que cobre um numero de
  // fabrica nao e evolucao, e conflito, e sai como aviso la embaixo.
  const factory = cell.origin === SPEC_LAYER.MODIFIED ? cell.replaces : null;
  const factoryValue = biggest(factory);

  return (
    <div className="border-b border-[var(--engine-border)] bg-[var(--engine-elevated)] px-4 py-6 sm:px-6">
      {pair ? (
        <FlexPair pair={pair} label={label} />
      ) : (
        <SingleNumber
          value={formatNumber(i18n.language, cell.value, 0)}
          unit={cell.unit}
          label={label}
          sub={[fuelBasisLabel(t, cell), basisLabel(t, cell)].filter(Boolean).join(" · ")}
        />
      )}

      {factoryValue !== null && factoryValue !== undefined ? (
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] font-semibold text-[var(--engine-text-muted)]">
          <span>
            {t("specSheet.hero.fromFactory", {
              value: `${formatNumber(i18n.language, factoryValue, 0)} ${factory.unit || ""}`.trim(),
            })}
          </span>
          <ArrowRight size={14} className="text-[var(--engine-accent)]" aria-hidden="true" />
          <span className="font-black text-[var(--engine-text)]">{t("specSheet.hero.today")}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <OriginTag tag={tag} />
        {cell.source?.doc ? (
          <span className="text-[10px] font-semibold text-[var(--engine-text-muted)]">
            {cell.source.doc}
            {cell.source.date ? ` · ${cell.source.date}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Uma celula da grade. Nunca vazia — se estivesse vazia nao teria sido criada. */
function GridCell({ cell, resolved, span }) {
  const { t, i18n } = useTranslation();
  const composed = cell.id === "engine";
  const text = composed ? cell.text : cellText(t, i18n.language, cell);
  const pair = composed ? null : cellPair(i18n.language, cell);
  const tag = composed ? null : resolved.tags[cell.id];
  const inferred = composed ? cell.inferred : cell.confidence === CONFIDENCE.INFERRED;
  const factory = !composed && cell.origin === SPEC_LAYER.MODIFIED ? cell.replaces : null;
  const factoryValue = biggest(factory);

  return (
    <div
      className={`min-w-0 border-b border-[var(--engine-border)] p-3.5 sm:p-4 ${
        span ? "col-span-2" : "border-r last:border-r-0 odd:border-r"
      }`}
    >
      <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-[var(--engine-text-muted)]">
        {composed ? t("specSheet.field.engine") : fieldLabel(t, cell.id)}
      </p>

      {pair ? (
        <>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-baseline gap-1.5">
            <p className="spec-number text-center text-[1.05rem]">{pair.ethanol}</p>
            <span aria-hidden="true" className="text-[9px] font-black text-[var(--engine-text-muted)]">
              |
            </span>
            <p className="spec-number text-center text-[1.05rem]">{pair.gasoline}</p>
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold text-[var(--engine-text-muted)]">
            {t("specSheet.flexBoth", { unit: pair.unit })}
          </p>
        </>
      ) : (
        <p
          className={`mt-1.5 truncate font-display text-[1.05rem] font-extrabold leading-tight text-[var(--engine-text)] ${
            inferred ? "underline decoration-dotted underline-offset-4" : ""
          }`}
          title={text || ""}
        >
          {text}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {factoryValue !== null && factoryValue !== undefined ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--engine-text-muted)]">
            {t("specSheet.hero.fromFactory", {
              value: `${formatNumber(
                i18n.language,
                factoryValue,
                cell.id === "torque" ? 1 : 0,
              )} ${factory.unit || ""}`.trim(),
            })}
            <ArrowRight size={11} className="text-[var(--engine-accent)]" aria-hidden="true" />
          </span>
        ) : null}
        {inferred ? (
          <span className="text-[10px] font-semibold text-[var(--engine-text-muted)]">
            {t("specSheet.inferred")}
          </span>
        ) : null}
        {tag && tag !== "fabrica" ? <OriginTag tag={tag} /> : null}
      </div>
    </div>
  );
}

/**
 * A regua em que o numero foi medido.
 *
 * "400 cv na roda" e "400 cv no motor" sao 15-20% de diferenca, e toda ficha de
 * fabrica e no motor. Quando os dois aparecem juntos, o erro nao e mostrar os
 * dois — e desenhar uma seta entre eles como se um virasse o outro. Aqui eles
 * ficam lado a lado, com um filete TRACEJADO no lugar da seta, porque o
 * tracejado e o unico jeito grafico de dizer "estes dois nao se ligam".
 */
function BasisRuler({ cell, factoryPower }) {
  const { t, i18n } = useTranslation();

  return (
    <div className="border-b border-[var(--engine-border)] px-4 py-4 sm:px-6">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--engine-text-muted)]">
        <Split size={12} aria-hidden="true" />
        {t("specSheet.basisTitle")}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <p className="spec-number text-2xl">
            {formatNumber(i18n.language, factoryPower, 0)}
            <span className="ml-1 text-[11px] font-bold text-[var(--engine-text-muted)]">cv</span>
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--engine-text-muted)]">
            {t("specSheet.basis.crank")}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="h-10 w-0 border-l border-dashed border-[var(--engine-border-strong)]"
        />
        <div className="text-center">
          <p className="spec-number text-2xl">
            {formatNumber(i18n.language, cell.value, 0)}
            <span className="ml-1 text-[11px] font-bold text-[var(--engine-text-muted)]">cv</span>
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--engine-text-muted)]">
            {t("specSheet.basis.wheel")}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
        {t("specSheet.basisExplain")}
      </p>
    </div>
  );
}

/**
 * A ficha inteira, em leitura.
 *
 * O mesmo componente serve as tres entradas. O que muda entre elas e so
 * `canEdit`: no carro de outra pessoa somem a faixa de confirmacao (perguntar
 * "e esta a sua versao?" ao vizinho nao faz sentido), os avisos de plausibilidade
 * (que sao conversa entre o produto e o dono) e o heroi vazio (que ali seria um
 * buraco em vez de um convite).
 */
export function SpecSheetView({
  resolved,
  versionString,
  canEdit = false,
  highlightUnlock = false,
  onEdit,
  onCorrectVersion,
}) {
  const { t, i18n } = useTranslation();

  const gridCells = useMemo(() => {
    const engineCell = buildEngineCell(t, i18n.language, resolved.fields);
    return GRID_PRIORITY.map((id) => (id === "engine" ? engineCell : resolved.fields[id]))
      .filter((cell) => cell && (cell.id === "engine" || isValue(cell)))
      .slice(0, 4);
  }, [resolved, t, i18n.language]);

  const powerCell = resolved.fields.powerCv;

  // O que nao sabemos. A potencia retida ja tem a hachura do heroi: repetir
  // aqui seria contar a mesma ausencia duas vezes na mesma tela.
  const unknown = [...resolved.held, ...resolved.absent].filter(
    (cell) => !(cell.id === "powerCv" && powerCell?.status === SPEC_STATUS.HELD),
  );

  const showConfirm =
    canEdit &&
    (resolved.held.length > 0 ||
      resolved.list.some((cell) => isValue(cell) && cell.confidence === CONFIDENCE.INFERRED));

  const wheelPower = powerCell?.basis === "wheel" ? powerCell : null;
  const wheelFactory = biggest(wheelPower?.replaces);

  const issues = canEdit
    ? resolved.issues.filter(
        (issue) =>
          issue.code !== SPEC_ISSUE.WHEEL_BASIS_NOT_COMPARABLE &&
          issue.code !== SPEC_ISSUE.SHEET_ON_GOAL_CAR,
      )
    : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)]">
      {/* O credito do destrave. Fica enquanto a correcao existir, porque e
          verdade permanente; ganha peso so na volta do save, que e quando a
          pessoa acabou de fazer por merecer. */}
      {resolved.unlockedBy.length > 0 && (
        <div
          className={`flex items-start gap-2.5 border-b px-4 py-3 sm:px-6 ${
            highlightUnlock
              ? "engine-rise border-[var(--engine-accent)]/40 bg-[var(--engine-accent-soft)]"
              : "border-[var(--engine-border)] bg-[var(--engine-surface-2)]"
          }`}
        >
          <Sparkles
            size={15}
            className="mt-0.5 shrink-0 text-[var(--engine-accent)]"
            aria-hidden="true"
          />
          <p className="text-[12px] leading-relaxed text-[var(--engine-text)]">
            {t("specSheet.unlocked", {
              fields: resolved.unlockedBy.map((id) => fieldLabel(t, id)).join(", "),
            })}
          </p>
        </div>
      )}

      {showConfirm && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 sm:px-6">
          <div className="min-w-[170px] flex-1">
            <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-[var(--engine-text-muted)]">
              {t("specSheet.confirmKicker")}
            </p>
            <p className="mt-0.5 text-[12.5px] font-bold leading-snug text-[var(--engine-text)]">
              {versionString}
            </p>
          </div>
          <button
            type="button"
            onClick={onCorrectVersion}
            className="min-h-[40px] shrink-0 rounded-xl border border-[var(--engine-border-strong)] px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
          >
            {t("specSheet.confirmAction")}
          </button>
        </div>
      )}

      <Hero
        cell={powerCell}
        resolved={resolved}
        canEdit={canEdit}
        onEdit={onEdit}
        onCorrectVersion={onCorrectVersion}
      />

      {gridCells.length > 0 && (
        <div className="grid grid-cols-2">
          {gridCells.map((cell, index) => (
            <GridCell
              key={cell.id}
              cell={cell}
              resolved={resolved}
              /* Numero impar de celulas: a ultima ocupa a linha inteira. Meia
                 linha vazia parece celula que nao carregou. */
              span={gridCells.length % 2 === 1 && index === gridCells.length - 1}
            />
          ))}
        </div>
      )}

      {wheelPower && wheelFactory !== null && wheelFactory !== undefined && (
        <BasisRuler cell={wheelPower} factoryPower={wheelFactory} />
      )}

      {(resolved.mods.length > 0 || (resolved.stage && resolved.stage !== "stock") || resolved.notes) && (
        <div className="border-b border-[var(--engine-border)] px-4 py-4 sm:px-6">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--engine-text-muted)]">
            <Wrench size={12} aria-hidden="true" />
            {t("specSheet.modsTitle")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {resolved.stage && resolved.stage !== "stock" ? (
              <span className="rounded-full border border-[var(--engine-accent)]/45 bg-[var(--engine-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--engine-accent)]">
                {stageLabel(t, resolved.stage)}
              </span>
            ) : null}
            {resolved.mods.map((id) => (
              <span
                key={id}
                className="rounded-full border border-[var(--engine-border-strong)] px-2.5 py-1 text-[10px] font-bold text-[var(--engine-text-muted)]"
              >
                {modLabel(t, id)}
              </span>
            ))}
          </div>
          {resolved.notes ? (
            <p className="mt-3 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--engine-text)]">
              {resolved.notes}
            </p>
          ) : null}
        </div>
      )}

      {issues.length > 0 && (
        <ul className="border-b border-[var(--engine-border)] px-4 py-3 sm:px-6">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.field || "geral"}-${index}`}
              className="flex gap-2 py-1 text-[12px] leading-relaxed text-[var(--engine-text-muted)]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--engine-accent)]"
              />
              {issueLabel(t, issue)}
            </li>
          ))}
        </ul>
      )}

      {unknown.length > 0 && (
        <details className="border-b border-[var(--engine-border)] [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[var(--engine-text-muted)] transition hover:text-[var(--engine-text)] sm:px-6">
            {t("specSheet.unknownTitle")}
            <span className="tabular-nums">({unknown.length})</span>
          </summary>
          <ul className="grid gap-2.5 px-4 pb-4 sm:px-6">
            {unknown.map((cell) => (
              <li key={cell.id} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--engine-border-strong)] ${
                    cell.status === SPEC_STATUS.HELD ? "spec-hatch" : ""
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-extrabold text-[var(--engine-text)]">
                    {fieldLabel(t, cell.id)}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-[var(--engine-text-muted)]">
                    {cell.status === SPEC_STATUS.HELD
                      ? holdLabel(t, cell.reason)
                      : t(`specSheet.absent.${cell.reason}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="bg-[var(--engine-surface-2)] px-4 py-3.5 sm:px-6">
        <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-[var(--engine-text-muted)]">
          {t("specSheet.fullVersion")}
        </p>
        <p className="mt-1 text-[12.5px] font-bold leading-snug text-[var(--engine-text)]">
          {versionString}
        </p>
      </div>

      {/* O heroi vazio ja carrega o convite; repetir o botao logo abaixo dele
          seria pedir duas vezes a mesma coisa. */}
      {canEdit && powerCell?.status !== SPEC_STATUS.ABSENT && (
        <div className="border-t border-[var(--engine-border)] px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[44px] items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[var(--engine-accent)] transition hover:brightness-110"
          >
            <Gauge size={14} aria-hidden="true" />
            {t("specSheet.editAction")}
          </button>
        </div>
      )}
    </div>
  );
}
