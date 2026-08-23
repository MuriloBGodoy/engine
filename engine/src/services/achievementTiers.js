/**
 * A régua das conquistas: ids, degraus e as regras de qual selo aparece.
 *
 * Separado de `achievements.js` de propósito, e sem NENHUMA importação: assim a
 * lógica que decide o que a tela mostra pode ser testada em Node direto, sem
 * arrastar o Firebase junto. (`achievements.js` importa `./firebase` sem
 * extensão — o Vite resolve, o Node não.)
 *
 * A LISTA DE IDS AQUI ESPELHA A REGRA DO FIRESTORE. Se mudar um, mude o outro —
 * id fora da lista é negado pelo servidor. `npm run check:achievements` compara
 * as duas e fica vermelho se divergirem.
 */

/** Degraus de curtidas recebidas, somando todos os posts da pessoa. */
export const LIKE_TIERS = [1000, 10000, 50000, 100000, 500000, 1000000];

/** Conquistas que acontecem uma vez, por um marco que não é contagem de curtida. */
export const MILESTONE_IDS = [
  "first_goal",
  "first_conquest",
  "owned_car",
  "followers_1000",
];

export const likeTierId = (tier) => `likes_${tier}`;

/** Os dez ids, na mesma ordem da lista fechada da regra. */
export const ACHIEVEMENT_IDS = [...MILESTONE_IDS, ...LIKE_TIERS.map(likeTierId)];

/** Id conhecido pela regra do Firestore? Fora da lista, o servidor nega. */
export const isAchievementId = (id) => ACHIEVEMENT_IDS.includes(id);

/**
 * Quais degraus a tela deve mostrar: os já conquistados, mais UM à frente.
 *
 * Mostrar a escada inteira no primeiro dia anunciaria um alcance que o produto
 * não tem — quem tem 200 curtidas não precisa ver o degrau de 1 milhão. Quem
 * tem zero vê o de 1k, para a seção nunca aparecer vazia.
 */
export const visibleLikeTiers = (likesReceived = 0) => {
  const conquistados = LIKE_TIERS.filter((tier) => likesReceived >= tier);
  const proximo = LIKE_TIERS.find((tier) => likesReceived < tier);
  return proximo ? [...conquistados, proximo] : conquistados;
};

/** Degraus efetivamente cruzados por um total de curtidas. */
export const earnedLikeTiers = (likesReceived = 0) =>
  LIKE_TIERS.filter((tier) => likesReceived >= tier);

/**
 * A faixa que um POST exibe: só a mais alta que ele bateu sozinho.
 *
 * No post o selo de 10k sobrescreve o de 1k — é o mesmo componente com outro
 * número, não um selo novo. No perfil as duas faixas continuam listadas, e é
 * por isso que esta função é separada de `earnedLikeTiers`.
 */
export const postBadgeTier = (postLikes = 0) => {
  const cruzados = LIKE_TIERS.filter((tier) => postLikes >= tier);
  return cruzados.length ? cruzados[cruzados.length - 1] : null;
};

