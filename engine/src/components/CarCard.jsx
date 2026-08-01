import { Calculator, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { estimateOwnership } from "../services/ownership";

export function CarCard({ car, onDelete, onOpenOwnership, hideValues = false }) {
  const { i18n, t } = useTranslation();
  const ownershipTotal = car.ownership
    ? estimateOwnership(car, car.ownership, car.ownership).totals.monthlyTotal
    : null;
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
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur-sm transition hover:bg-[var(--engine-accent)] focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
          title={t("common.delete")}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--engine-accent)]">
            {car.brand?.toUpperCase()}
          </p>
          <h3 className="mt-1 truncate text-xl font-extrabold italic tracking-tight text-[var(--engine-text)]">
            {car.model}
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-[var(--engine-text-subtle)]">
            {car.year}
          </p>
        </div>

        <div className="space-y-3 pt-2">
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
