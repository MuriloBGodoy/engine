/**
 * Testes das regras do Firestore para /events, rodados contra o emulador.
 *
 * Não roda sozinho — precisa do emulador de pé e de duas dependências que não
 * ficam no projeto:
 *
 *   npm i -D @firebase/rules-unit-testing firebase
 *   firebase emulators:exec --only firestore --project demo-rules-check \
 *     "node scripts/check-firestore-rules.mjs"
 *
 * (O emulador sobe na 8099 porque a 8080 é do backend Java em dev.)
 *
 * Por que existe: a coleção `events` não tinha regra nenhuma e caía no deny
 * padrão. A feature de Eventos nunca funcionou em produção — nem para quem
 * estava logado — e ninguém percebeu, porque a tela mostrava "Nenhum evento
 * encontrado", que soa como ausência e não como proibição. Regra de segurança
 * que falha calada é exatamente o que precisa de teste.
 *
 * As asserções foram mutadas em 22/08/2026 (barrar o visitante, tirar os pisos
 * do RSVP, deixar o RSVP mexer no título, liberar delete pra qualquer logado) —
 * todas ficaram vermelhas.
 *
 * Duas armadilhas encontradas ao mutar, para quem for mexer aqui:
 *   - `allow read: if true;` aparece 3x no arquivo de regras; âncora de mutação
 *     precisa ser única, senão você muta o publicProfiles e conclui que o teste
 *     é fraco.
 *   - os dois pisos do RSVP (tamanho da lista e contador) se cobrem: tirar só
 *     um não muda comportamento nenhum e a mutação passa verde à toa.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = await initializeTestEnvironment({
  projectId: "demo-rules-check",
  firestore: {
    rules: fs.readFileSync(path.join(root, "firestore.rules"), "utf8"),
    host: "127.0.0.1",
    port: 8099,
  },
});

const visitante = env.unauthenticatedContext().firestore();
const dono = env.authenticatedContext("dono").firestore();
const outro = env.authenticatedContext("outro").firestore();

const semear = (id, data) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "events", id), data));

const base = (extra = {}) => ({
  title: "Encontro",
  type: "casual",
  eventDate: "2026-09-01",
  createdBy: "dono",
  participantCount: 0,
  ...extra,
});

let pass = 0;
let fail = 0;
const t = async (nome, fn) => {
  try {
    await fn();
    console.log(`  ok   ${nome}`);
    pass += 1;
  } catch (error) {
    console.log(`  FALHA ${nome}\n         ${String(error).split("\n")[0].slice(0, 140)}`);
    fail += 1;
  }
};

console.log("\nregras de /events\n");

await semear("e1", base());
await t("visitante LÊ um evento (era isso que estava quebrado)", () =>
  assertSucceeds(getDoc(doc(visitante, "events/e1"))));
await t("visitante LISTA eventos", () =>
  assertSucceeds(getDocs(collection(visitante, "events"))));
await t("visitante NÃO cria", () =>
  assertFails(setDoc(doc(visitante, "events/x1"), base())));
await t("logado cria com createdBy próprio", () =>
  assertSucceeds(setDoc(doc(dono, "events/e2"), base())));
await t("logado NÃO cria se passar por outro", () =>
  assertFails(setDoc(doc(outro, "events/e3"), base({ createdBy: "dono" }))));
await t("dono edita o próprio evento", () =>
  assertSucceeds(updateDoc(doc(dono, "events/e1"), { title: "Novo título" })));
await t("estranho NÃO edita título alheio", () =>
  assertFails(updateDoc(doc(outro, "events/e1"), { title: "Invadido" })));
await t("estranho NÃO se promove a dono", () =>
  assertFails(updateDoc(doc(outro, "events/e1"), { createdBy: "outro" })));

await semear("e4", base({ participants: [], participantCount: 0 }));
await t("estranho CONFIRMA presença (RSVP entra)", () =>
  assertSucceeds(updateDoc(doc(outro, "events/e4"), {
    participants: [{ uid: "outro" }],
    participantCount: 1,
  })));

await semear("e5", base({
  participants: [{ uid: "a" }, { uid: "b" }, { uid: "c" }],
  participantCount: 3,
}));
await t("estranho CANCELA a própria presença (lista -1)", () =>
  assertSucceeds(updateDoc(doc(outro, "events/e5"), {
    participants: [{ uid: "a" }, { uid: "b" }],
    participantCount: 2,
  })));
await t("estranho NÃO apaga a lista inteira", () =>
  assertFails(updateDoc(doc(outro, "events/e5"), { participants: [], participantCount: 0 })));
await t("estranho NÃO infla o contador", () =>
  assertFails(updateDoc(doc(outro, "events/e5"), {
    participants: [{ uid: "a" }, { uid: "b" }, { uid: "c" }],
    participantCount: 999,
  })));
await t("visitante deslogado NÃO faz RSVP", () =>
  assertFails(updateDoc(doc(visitante, "events/e5"), {
    participants: [{ uid: "a" }, { uid: "b" }, { uid: "c" }, { uid: "z" }],
    participantCount: 4,
  })));
await t("estranho NÃO apaga evento alheio", () =>
  assertFails(deleteDoc(doc(outro, "events/e5"))));
await t("dono apaga o próprio evento", () =>
  assertSucceeds(deleteDoc(doc(dono, "events/e5"))));

// `normalizeEvent` NÃO grava `participants`, então o evento nasce sem o campo.
// Semear com `participants: []` esconderia justamente o caso real do primeiro
// RSVP — foi um buraco no primeiro teste que escrevi.
console.log("\nforma real de produção: evento sem o campo `participants`\n");
await semear("prod1", {
  title: "Encontro",
  type: "casual",
  eventDate: "2026-09-01",
  createdBy: "dono",
  participantCount: 0,
  maxParticipants: 0,
});
await t("primeiro RSVP num evento que nasceu sem `participants`", () =>
  assertSucceeds(updateDoc(doc(outro, "events/prod1"), {
    participants: [{ uid: "outro" }],
    participantCount: 1,
  })));
await t("estranho ainda NÃO edita título nesse mesmo evento", () =>
  assertFails(updateDoc(doc(outro, "events/prod1"), { title: "Invadido" })));

await env.cleanup();
console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
