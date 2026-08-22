import {
  Calculator,
  ChevronRight,
  Key,
  PiggyBank,
  Receipt,
  Trash2,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { resolveVehicleSpecSheet } from "../services/carSpecSheet";
import { summaryTokens } from "./specsheet/labels";
import { estimateOwnership } from "../services/ownership";
import { forecastCompletion } from "../services/forecast";
import { expenseInsights } from "../services/expenses";
import { CAR_TYPE_OWNED } from "../services/db";

/**
 * O bloco de identidade, clicavel ou nao.
 *
 * Sem `onOpenSpecs` ele continua sendo o texto de sempre — importa porque o
 * CarCard tambem aparece em tela onde a ficha nao faz sentido, e um botao que
 * nao leva a lugar nenhum e pior que nenhum botao.
 *
 * O `stopPropagation` nao e detalhe: na Garagem o card INTEIRO ja abre a edicao
 * do carro. Sem ele, tocar na identidade abriria os dois.
 */
function SpecTrigger({ onOpenSpecs, car, label, children }) {
  if (!onOpenSpecs) return <div className="min-w-0">{children}</div>;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onOpenSpecs(car);
      }}
      className="group/specs -mx-2 -mt-1 block w-[calc(100%+1rem)] min-w-0 rounded-xl px-2 py-1 text-left transition-colors hover:bg-[var(--engine-surface-2)]"
    >
      {children}
    </button>
  );
}

export function CarCard({
  car,
  onDelete,
  onOpenOwnership,
  onAddContribution,
  onAddExpense,
  onMarkAchieved,
  onOpenSpecs,
  hideValues = false,
}) {
  const { i18n, t } = useTranslation();
  const ownershipTotal = car.ownership
    ? estimateOwnership(car, car.ownership, car.ownership).totals.monthlyTotal
    : null;
  const isOwned = car.type === CAR_TYPE_OWNED;
  // Meta batida mas ainda não confirmada: não faz sentido anunciar "falta
  // R$ 0,00". Vira convite pra pessoa declarar a conquista.
  const reachedGoal =
    !isOwned && car.targetValue > 0 && car.savedValue >= car.targetValue;
  // Data prevista no ritmo dos aportes; some quando ainda não há ritmo.
  const forecast = forecastCompletion(car);
  // Gasto real do mês, quando há histórico suficiente para a média valer.
  const spending = isOwned ? expenseInsights(car) : null;
  // A linha de resumo mostra SO o que o parser garante. Nada de "potencia nao
  // confirmada" aqui: com potencia de fabrica faltando em ~62% dos carros
  // reais, essa ressalva viraria um pedido de desculpas repetido em quase todo
  // card da garagem. A ausencia se explica na ficha, que e onde cabe o porque.
  const specs = useMemo(() => {
    if (!onOpenSpecs) return [];
    try {
      return summaryTokens(t, i18n.language, resolveVehicleSpecSheet(car));
    } catch {
      // Carro antigo com marca/modelo fora do padrao nao pode derrubar a
      // garagem inteira por causa de uma linha de resumo.
      return [];
    }
  }, [car, onOpenSpecs, t, i18n.language]);

  const percentage = Math.min(
    car.targetValue ? (car.savedValue / car.targetValue) * 100 : 0,
    100,
  ).toFixed(1);

  const fallbackImage =
    "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=600";

  return (
    <div className="engine-card engine-card-hover group relative flex h-[560px] flex-col overflow-hidden">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-[var(--engine-surface-2)] via-[var(--engine-surface-2)]/50 to-[var(--engine-surface)] flex items-center justify-center aspect-video">
        <img
          src={car.image}
          alt={car.model}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = fallbackImage;
            e.target.classList.add("opacity-60");
          }}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <button
          onClick={onDelete}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur-sm transition hover:bg-[var(--engine-accent)] focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100 lg:h-9 lg:w-9"
          title={t("common.delete")}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        {/* O bloco de identidade E o botao da ficha tecnica — decisao do
            Murilo, contra o terceiro botao no rodape. Tres acoes de mesmo peso
            transformavam o card numa lista de botoes; aqui a ficha usa o espaco
            morto que o `justify-between` ja deixava no meio, e o alvo de toque
            fica onde a pessoa ja olha para saber que carro e este.

            De quebra resolve o truncamento: como a ficha passa a ser o lugar
            onde o nome completo da versao cabe, o modelo pode quebrar em duas
            linhas em vez de virar "ONIX HATCH LT 1.0 12V Flex 5p M...". */}
        <SpecTrigger onOpenSpecs={onOpenSpecs} car={car} label={t("specSheet.cardAction")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--engine-accent)]">
                {car.brand?.toUpperCase()}
              </p>
              <h3
                className={`mt-1 text-xl font-extrabold italic leading-tight tracking-tight text-[var(--engine-text)] ${
                  onOpenSpecs ? "line-clamp-2" : "truncate"
                }`}
              >
                {car.model}
              </h3>
              <p className="mt-1 truncate text-xs font-medium text-[var(--engine-text-muted)]">
                {car.year}
              </p>
            </div>
            {onOpenSpecs && (
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="mt-1 shrink-0 text-[var(--engine-text-muted)] transition group-hover/specs:translate-x-0.5 group-hover/specs:text-[var(--engine-accent)]"
              />
            )}
          </div>

          {specs.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold text-[var(--engine-text-muted)]">
              {specs.map((token, index) => (
                <span key={token} className="flex items-center gap-1.5">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="h-[3px] w-[3px] rounded-full bg-[var(--engine-border-strong)]"
                    />
                  )}
                  {token}
                </span>
              ))}
            </p>
          )}
        </SpecTrigger>

        <div className="space-y-3 pt-2">
          {/* Carro que a pessoa já tem não tem progresso a exibir: no lugar da
              barra entra o selo de garagem. */}
          {isOwned ? (
            <div className="flex items-center justify-between border-t border-[var(--engine-border)] pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--engine-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--engine-accent)]">
                <Key size={11} />
                {t("car.owned")}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--engine-text-muted)]">
                {car.year}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <span className="text-[var(--engine-text-subtle)]">
                  {t("car.progress")}
                </span>
                <span className="tabular-nums text-[var(--engine-accent)]">
                  {percentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--engine-surface-2)]">
                <div
                  className="h-full rounded-full bg-[var(--engine-accent)] transition-all duration-700"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {reachedGoal ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkAchieved?.(car);
                  }}
                  disabled={!onMarkAchieved}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--engine-accent)] bg-[var(--engine-accent)] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition hover:brightness-95 disabled:opacity-60"
                >
                  <Trophy size={14} />
                  {t("car.markAchieved")}
                </button>
              ) : (
                <div className="flex items-end justify-between border-t border-[var(--engine-border)] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--engine-text-subtle)]">
                    {t("car.remaining")}
                  </p>
                  <p className="text-lg font-extrabold tabular-nums text-[var(--engine-text)]">
                    {hideValues
                      ? "R$ --"
                      : new Intl.NumberFormat(i18n.language, {
                          style: "currency",
                          currency: "BRL",
                        }).format(car.targetValue - car.savedValue)}
                  </p>
                </div>
              )}
            </>
          )}

          {!isOwned && !reachedGoal && onAddContribution && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAddContribution(car);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--engine-accent)]/30 bg-[var(--engine-accent-soft)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--engine-accent)]"
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--engine-accent)]">
                <PiggyBank size={14} />
                {t("contribution.cardAction")}
              </span>
              {forecast && (
                <span className="text-[11px] font-bold tabular-nums text-[var(--engine-text-muted)]">
                  {forecast.date.toLocaleDateString(i18n.language, {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </button>
          )}

          {/* O carro que já é seu não tem meta a alimentar — tem conta a pagar.
              No lugar do aporte entra o gasto, e o número à direita é o que
              esse carro está custando por mês de verdade. */}
          {isOwned && onAddExpense && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAddExpense(car);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--engine-accent)]/30 bg-[var(--engine-accent-soft)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--engine-accent)]"
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--engine-accent)]">
                <Receipt size={14} />
                {t("expenses.cardAction")}
              </span>
              {spending?.monthlyAverage && (
                <span className="text-[11px] font-bold tabular-nums text-[var(--engine-text-muted)]">
                  {hideValues
                    ? "R$ --"
                    : t("expenses.perMonth", {
                        value: new Intl.NumberFormat(i18n.language, {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }).format(spending.monthlyAverage),
                      })}
                </span>
              )}
            </button>
          )}

          {onOpenOwnership && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onOpenOwnership(car);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--engine-accent)]"
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--engine-text-subtle)]">
                <Calculator size={14} className="text-[var(--engine-accent)]" />
                {t("ownership.cardMonthly")}
              </span>
              <span className="text-sm font-extrabold tabular-nums text-[var(--engine-text)]">
                {ownershipTotal === null
                  ? t("ownership.cardSimulate")
                  : hideValues
                    ? "R$ --"
                    : new Intl.NumberFormat(i18n.language, {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(ownershipTotal)}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
