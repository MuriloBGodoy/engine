import { useTranslation } from "react-i18next";
import { MILESTONE_ICON } from "./icons";

/**
 * Card de um marco — "Primeira Meta", "Primeira Conquista", "Já é meu",
 * "Mil na garagem". Travado não some, aparece esmaecido (decisão 2 da sessão
 * de 22/08/2026): o círculo vira contorno tracejado e o texto de baixo troca
 * a legenda "Conquistado" pela dica de como desbloquear.
 *
 * `progress` só faz sentido para marcos com contagem (hoje, só
 * `followers_1000`); os demais são eventos binários e ignoram a prop.
 */
export function AchievementMilestone({ id, state = "unlocked", progress }) {
  const { t } = useTranslation();
  const Icon = MILESTONE_ICON[id];
  const locked = state === "locked";

  const statusText = locked
    ? progress
      ? t("achievements.followersProgress", { atual: progress.atual, alvo: progress.alvo })
      : t(`achievements.items.${id}.desc`)
    : t("achievements.unlocked");

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-3.5 ${
        locked ? "opacity-80" : ""
      }`}
    >
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${
          locked
            ? "border border-dashed border-[var(--engine-border-strong)] bg-[var(--engine-surface-2)] text-[var(--engine-text-subtle)]"
            : "bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
        }`}
      >
        {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-extrabold leading-tight text-[var(--engine-text)]">
          {t(`achievements.items.${id}.name`)}
        </p>
        <p
          className={`mt-0.5 text-[11px] font-bold leading-snug ${
            locked ? "font-semibold text-[var(--engine-text-muted)]" : "text-[var(--engine-accent)]"
          }`}
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
