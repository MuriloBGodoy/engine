/**
 * Conquistas do Engine.
 *
 * Cada conquista é um documento em `users/{uid}/achievements/{id}`, com o id
 * sendo o próprio marco. Não há campo de estado: existir é ter conquistado.
 *
 * Por que assim, e não um contador ou uma lista no perfil:
 *
 * - **Dedup de graça.** O Firestore nega `create` em documento que já existe.
 *   Duas detecções simultâneas do mesmo marco não viram duas conquistas nem
 *   duas notificações — a segunda falha sozinha, sem transação.
 * - **Revogável.** Fraude descoberta depois se desfaz apagando o documento,
 *   sem reconstruir nada, porque ele não guarda estado incremental.
 * - **Escrita alheia contida.** Quem detecta o cruzamento é o cliente de quem
 *   praticou a ação (quem curtiu, quem seguiu), porque o Firebase está no plano
 *   Spark e não há Cloud Function pra fazer isso no servidor. Ou seja: é escrita
 *   no perfil de OUTRA pessoa. A regra prende por uma lista fechada de ids e por
 *   um corpo de um campo só, então o máximo que se consegue é dar a alguém uma
 *   conquista que ela já ia ganhar.
 *
 * A LISTA DE IDS AQUI ESPELHA A REGRA. Se mudar um, mude o outro — id fora da
 * lista é negado pelo servidor (ver `firestore.rules`, match
 * `/users/{userId}/achievements/{achievementId}`).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, firestore } from "./firebase";
import { earnedLikeTiers, isAchievementId, likeTierId } from "./achievementTiers";

const ACHIEVEMENTS_SUBCOLLECTION = "achievements";

// A régua vive num módulo sem dependência, para poder ser testada em Node.
// Reexportada aqui para quem consome ter um endereço só.
export {
  isAchievementId,
  LIKE_TIERS,
  MILESTONE_IDS,
  ACHIEVEMENT_IDS,
  likeTierId,
  visibleLikeTiers,
  earnedLikeTiers,
  postBadgeTier,
} from "./achievementTiers";

const achievementsRef = (userId) =>
  collection(firestore, "users", userId, ACHIEVEMENTS_SUBCOLLECTION);

/** Ids já conquistados por alguém. Leitura pública, como o perfil. */
export const listAchievements = async (userId) => {
  if (!userId) return new Set();
  try {
    const snapshot = await getDocs(achievementsRef(userId));
    return new Set(snapshot.docs.map((d) => d.id));
  } catch {
    // Conquista é enfeite do perfil: se falhar, o perfil abre sem selo em vez
    // de não abrir.
    return new Set();
  }
};

/**
 * Concede um marco, se ele ainda não existir.
 *
 * Devolve `true` só quando ESTA chamada foi a que criou — é esse retorno que
 * decide se a notificação sai, e é o que impede duas abas abertas de avisarem
 * duas vezes. O `create` que perde a corrida falha na regra, não aqui.
 */
export const grantAchievement = async (userId, achievementId) => {
  if (!userId || !auth.currentUser || !isAchievementId(achievementId)) return false;
  try {
    const alvo = doc(firestore, "users", userId, ACHIEVEMENTS_SUBCOLLECTION, achievementId);
    // `create` puro: sem merge, para o Firestore negar quando já existe. Com
    // merge isto viraria update e a dedup sumiria.
    await setDoc(alvo, { unlockedAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
};

/** Revoga. É do dono (ou da moderação) — a rede de segurança contra fraude. */
export const revokeAchievement = async (userId, achievementId) => {
  if (!userId || !isAchievementId(achievementId)) return false;
  try {
    await deleteDoc(
      doc(firestore, "users", userId, ACHIEVEMENTS_SUBCOLLECTION, achievementId),
    );
    return true;
  } catch {
    return false;
  }
};

/**
 * Concede os marcos que dependem só da garagem da própria pessoa.
 *
 * Recebe os fatos já apurados em vez dos carros: assim este módulo não precisa
 * saber o que é "tipo do carro" nem "aporte total" — quem sabe disso é o
 * `db.js`, e o serviço de conquistas fica com uma responsabilidade só.
 *
 * Escrita no próprio perfil, então não tem a complicação dos marcos de curtida:
 * sem concorrência de terceiro, sem notificação (a pessoa está na tela, quem
 * avisa é o toast).
 */
export const syncOwnMilestones = async (userId, { temMeta, temProprio, temConquistado }) => {
  if (!userId) return [];
  const alvos = [
    temMeta && "first_goal",
    temProprio && "owned_car",
    temConquistado && "first_conquest",
  ].filter(Boolean);
  if (!alvos.length) return [];

  const jaTem = await listAchievements(userId);
  const concedidos = [];
  for (const id of alvos) {
    if (jaTem.has(id)) continue;
    if (await grantAchievement(userId, id)) concedidos.push(id);
  }
  return concedidos;
};

/**
 * Confere os degraus de curtida de alguém e concede o que faltar.
 *
 * Roda no cliente de quem acabou de curtir, com o total vindo de
 * `countLikesReceived`, que conta a subcoleção — não o `likesCount` que fica no
 * post. Aquele é número de vitrine e a regra só consegue prender o passo em ±1,
 * então dava pra empurrar de um em um até o selo; este conta documento que
 * ninguém escreve no lugar do outro.
 *
 * Devolve só os marcos que ESTA chamada concedeu, para a notificação sair uma
 * vez por conquista.
 */
export const syncLikeAchievements = async (userId, likesReceived) => {
  if (!userId) return [];
  const jaTem = await listAchievements(userId);
  const concedidos = [];
  for (const tier of earnedLikeTiers(likesReceived)) {
    const id = likeTierId(tier);
    if (jaTem.has(id)) continue;
    // Sequencial de propósito: se duas conquistas caem juntas, a ordem das
    // notificações segue a ordem dos degraus.
    if (await grantAchievement(userId, id)) concedidos.push(id);
  }
  return concedidos;
};
