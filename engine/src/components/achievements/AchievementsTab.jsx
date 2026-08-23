import { useTranslation } from "react-i18next";
import {
  LIKE_TIERS,
  MILESTONE_IDS,
  likeTierId,
  visibleLikeTiers,
} from "../../services/achievements";
import { AchievementBadge } from "./AchievementBadge";
import { AchievementMilestone } from "./AchievementMilestone";

// A regra do Firestore só concede `followers_1000` ao chegar em 1.000 — o
// mesmo número mora aqui só para desenhar a barra de progresso enquanto o
// marco está travado.
const FOLLOWERS_TARGET = 1000;

function formatNumber(value, language) {
  return new Intl.NumberFormat(language).format(Math.round(value) || 0);
}

/**
 * Aba Conquistas do perfil — duas seções fechadas na pesquisa de 22/08/2026:
 * "Marcos" (eventos únicos) e "Curtidas" (a escada 1k→10k→...→1M). A escada
 * nunca aparece inteira: só os degraus já batidos, mais UM à frente
 * (decisão 4), resolvido por `visibleLikeTiers` em `services/achievements.js`
 * para não ter duas fontes da mesma regra.
 *
 * Componente puro: quem decide o que está desbloqueado é a camada de dados,
 * passada via `unlocked`.
 */
export function AchievementsTab({ unlocked = new Set(), likesReceived = 0, followersCount = 0 }) {
  const { t, i18n } = useTranslation();

  const milestonesUnlockedCount = MILESTONE_IDS.filter((id) => unlocked.has(id)).length;
  const likesUnlockedCount = LIKE_TIERS.filter((tier) => unlocked.has(likeTierId(tier))).length;
  const tiersToShow = visibleLikeTiers(likesReceived);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--engine-text)]">
          {t("achievements.sections.milestones")}
        </h3>
        <span className="text-[11.5px] font-bold text-[var(--engine-text-muted)]">
          {t("achievements.milestonesProgress", {
            atual: milestonesUnlockedCount,
            total: MILESTONE_IDS.length,
          })}
        </span>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {MILESTONE_IDS.map((id) => {
          const isUnlocked = unlocked.has(id);
          // Formatado aqui e não no card: a linha de curtidas logo abaixo já
          // separa milhar, e "612 de 1000" ao lado de "12.400 / 50.000" fica
          // com cara de esquecimento.
          const progress =
            !isUnlocked && id === "followers_1000"
              ? {
                  atual: formatNumber(followersCount, i18n.language),
                  alvo: formatNumber(FOLLOWERS_TARGET, i18n.language),
                }
              : undefined;
          return (
            <AchievementMilestone
              key={id}
              id={id}
              state={isUnlocked ? "unlocked" : "locked"}
              progress={progress}
            />
          );
        })}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--engine-text)]">
          {t("achievements.sections.likes")}
        </h3>
        <span className="text-[11.5px] font-bold text-[var(--engine-text-muted)]">
          {t("achievements.tiersProgress", {
            atual: likesUnlockedCount,
            total: LIKE_TIERS.length,
          })}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {tiersToShow.map((tier) => {
          const isUnlocked = unlocked.has(likeTierId(tier));
          return (
            <div key={tier} className="flex flex-col items-start gap-1.5">
              <AchievementBadge tier={tier} state={isUnlocked ? "unlocked" : "locked"} />
              {isUnlocked ? (
                <span className="pl-0.5 text-[11px] font-bold text-[var(--engine-text-muted)]">
                  {t("achievements.likeTierLabel", { alvo: formatNumber(tier, i18n.language) })}
                </span>
              ) : (
                <div className="w-[150px]">
                  <span className="pl-0.5 text-[11px] font-bold text-[var(--engine-text-muted)]">
                    {t("achievements.likesProgress", {
                      atual: formatNumber(likesReceived, i18n.language),
                      alvo: formatNumber(tier, i18n.language),
                    })}
                  </span>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--engine-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--engine-accent)] transition-[width] duration-500"
                      style={{ width: `${Math.min((likesReceived / tier) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
