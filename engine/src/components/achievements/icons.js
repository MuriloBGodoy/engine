import { Flag, Key, Trophy, Users } from "lucide-react";

/**
 * Ícone por marco — nenhum ícone novo entrou no vocabulário do produto:
 * Flag já é usado no menu do post ("denunciar"), Trophy já marca meta batida
 * em Community.jsx/CarCard.jsx, Key já é o selo de "carro que já é seu" no
 * CarCard, Users já identifica seguidores em toda a Comunidade.
 *
 * Ids fechados pela regra do Firestore (ver `src/services/achievements.js`) —
 * não adicionar chave aqui sem adicionar lá primeiro.
 */
export const MILESTONE_ICON = {
  first_goal: Flag,
  first_conquest: Trophy,
  owned_car: Key,
  followers_1000: Users,
};

/**
 * "1000" -> "1K", "1000000" -> "1M". Decisão da sessão de 22/08/2026: o
 * degrau de curtidas não tem nome, só o número por extenso — e essa
 * abreviação (K/M) é lida igual nos três idiomas do produto, então não
 * passa por i18n.
 */
export function formatTierLabel(tier) {
  if (tier >= 1_000_000) return `${tier / 1_000_000}M`;
  if (tier >= 1_000) return `${tier / 1_000}K`;
  return String(tier);
}
