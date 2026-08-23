/**
 * Travas do sistema de conquistas.
 *
 *   npm run check:achievements
 *
 * Duas coisas separadas:
 *
 * 1. A lógica dos degraus, que é pura e decide o que a tela mostra.
 * 2. Que a lista de ids do serviço é IDÊNTICA à lista fechada da regra do
 *    Firestore. Essa é a mais importante: são duas cópias da mesma verdade, em
 *    linguagens diferentes, e o servidor nega calado o id que não estiver na
 *    dele. Sem esta trava, acrescentar uma conquista só no JavaScript daria uma
 *    feature que parece pronta e é negada em produção — foi exatamente assim
 *    que a coleção `events` passou meses sem funcionar.
 *
 * O comportamento contra o Firestore (dedup, lista fechada, revogação) é testado
 * no emulador, em `scripts/check-firestore-rules.mjs` na raiz do repositório.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(ROOT, "..");

const {
  LIKE_TIERS,
  MILESTONE_IDS,
  ACHIEVEMENT_IDS,
  likeTierId,
  visibleLikeTiers,
  earnedLikeTiers,
  postBadgeTier,
} = await import(pathToFileURL(path.join(ROOT, "src/services/achievementTiers.js")).href);

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? `\n         ${detalhe}` : ""}`);
  }
};
const igual = (nome, obtido, esperado) =>
  check(
    nome,
    JSON.stringify(obtido) === JSON.stringify(esperado),
    `obtive ${JSON.stringify(obtido)}, esperava ${JSON.stringify(esperado)}`,
  );

console.log("\nconquistas\n");

// --- os ids batem com a regra do Firestore
const regras = fs.readFileSync(path.join(REPO, "firestore.rules"), "utf8");
const bloco = regras.slice(
  regras.indexOf("match /users/{userId}/achievements/{achievementId}"),
);
const naRegra = [...bloco.slice(0, bloco.indexOf("];")).matchAll(/"([a-z0-9_]+)"/g)].map(
  (m) => m[1],
);
igual("a lista de ids do serviço é idêntica à da regra", ACHIEVEMENT_IDS, naRegra);

// --- a régua
igual("os seis degraus, na ordem", LIKE_TIERS, [1000, 10000, 50000, 100000, 500000, 1000000]);
igual("os quatro marcos", MILESTONE_IDS, [
  "first_goal",
  "first_conquest",
  "owned_car",
  "followers_1000",
]);
check("o id do degrau é o esperado pela regra", likeTierId(1000) === "likes_1000");

// --- "um degrau à frente": nunca seção vazia, nunca a escada inteira
igual("com zero curtidas mostra o primeiro degrau (seção não nasce vazia)", visibleLikeTiers(0), [1000]);
igual("com as 11 curtidas reais de hoje, ainda só o primeiro", visibleLikeTiers(11), [1000]);
igual("faltando uma para o marco, o degrau segue sendo o mesmo", visibleLikeTiers(999), [1000]);
igual("ao cruzar 1k, o de 10k aparece", visibleLikeTiers(1000), [1000, 10000]);
igual("com 12.400, mostra 1k e 10k conquistados e 50k à frente", visibleLikeTiers(12400), [
  1000, 10000, 50000,
]);
igual(
  "no topo não existe 'próximo' para inventar",
  visibleLikeTiers(1000000),
  [1000, 10000, 50000, 100000, 500000, 1000000],
);
igual(
  "acima do topo continua igual",
  visibleLikeTiers(5000000),
  [1000, 10000, 50000, 100000, 500000, 1000000],
);

// --- conquistado é diferente de visível
igual("conquistado não inclui o degrau à frente", earnedLikeTiers(12400), [1000, 10000]);
igual("com 11 curtidas não se conquistou nada", earnedLikeTiers(11), []);

// --- o selo do post mostra só a faixa mais alta
check("post abaixo de mil não ganha selo", postBadgeTier(999) === null);
check("post com 1.500 mostra o de 1k", postBadgeTier(1500) === 1000);
check("post com 12.400 mostra o de 10k, não o de 1k", postBadgeTier(12400) === 10000);
check("post no topo mostra o de 1M", postBadgeTier(2000000) === 1000000);

console.log(falhas === 0 ? "\ntudo verde\n" : `\n${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
