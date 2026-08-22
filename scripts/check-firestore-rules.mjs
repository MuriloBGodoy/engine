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
 * Presença virou subcoleção em 22/08/2026. Antes era um array no documento do
 * evento, e confirmar presença era escrita no documento de OUTRA pessoa: como o
 * cancelamento reescrevia o array inteiro, nenhuma regra conseguia provar QUEM
 * tinha saído, e um usuário logado podia apagar a presença alheia. Os dois
 * testes marcados "o motivo da mudança" são exatamente esse caso.
 *
 * Duas armadilhas encontradas ao mutar, para quem for mexer aqui:
 *   - `allow read: if true;` aparece várias vezes no arquivo de regras; âncora
 *     de mutação precisa ser única, senão você muta o publicProfiles e conclui
 *     que o teste é fraco.
 *   - no modelo antigo os dois pisos do RSVP se cobriam: tirar só um não mudava
 *     comportamento nenhum e a mutação passava verde à toa.
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

const semear = (caminho, data) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), caminho), data));

const base = (extra = {}) => ({
  title: "Encontro",
  type: "casual",
  eventDate: "2026-09-01",
  createdBy: "dono",
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

console.log("\nevento\n");

await semear("events/e1", base());
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
await t("estranho NÃO edita evento alheio", () =>
  assertFails(updateDoc(doc(outro, "events/e1"), { title: "Invadido" })));
await t("estranho NÃO se promove a dono", () =>
  assertFails(updateDoc(doc(outro, "events/e1"), { createdBy: "outro" })));
await t("estranho NÃO apaga evento alheio", () =>
  assertFails(deleteDoc(doc(outro, "events/e1"))));

console.log("\npresença (subcoleção: um documento por pessoa)\n");

await semear("events/e4", base());
await t("visitante LÊ quem vai (a lista é pública, como o evento)", () =>
  assertSucceeds(getDocs(collection(visitante, "events/e4/participants"))));
await t("visitante deslogado NÃO confirma presença", () =>
  assertFails(setDoc(doc(visitante, "events/e4/participants/outro"), { uid: "outro" })));
await t("logado confirma a PRÓPRIA presença", () =>
  assertSucceeds(setDoc(doc(outro, "events/e4/participants/outro"), {
    uid: "outro",
    displayName: "Outro",
  })));
await t("logado atualiza o próprio doc (trocar o carro)", () =>
  assertSucceeds(updateDoc(doc(outro, "events/e4/participants/outro"), {
    carDetails: { brand: "BMW", model: "M4", year: "2023" },
  })));
await t("logado cancela a PRÓPRIA presença", () =>
  assertSucceeds(deleteDoc(doc(outro, "events/e4/participants/outro"))));

// O motivo de a subcoleção existir: no modelo de array, estas duas escritas
// eram possíveis, porque a regra não conseguia ver quem tinha saído.
await semear("events/e4/participants/terceiro", { uid: "terceiro", displayName: "Terceiro" });
await t("o motivo da mudança: estranho NÃO apaga a presença de OUTRA pessoa", () =>
  assertFails(deleteDoc(doc(outro, "events/e4/participants/terceiro"))));
await t("o motivo da mudança: estranho NÃO altera a presença de OUTRA pessoa", () =>
  assertFails(updateDoc(doc(outro, "events/e4/participants/terceiro"), {
    displayName: "Sequestrado",
  })));
await t("estranho NÃO confirma presença no nome de outro", () =>
  assertFails(setDoc(doc(outro, "events/e4/participants/alguem"), { uid: "alguem" })));
await t("uid do corpo tem que bater com o id do documento", () =>
  assertFails(setDoc(doc(outro, "events/e4/participants/outro"), { uid: "terceiro" })));
await t("nem o dono do evento mexe na presença alheia", () =>
  assertFails(deleteDoc(doc(dono, "events/e4/participants/terceiro"))));

// Contador: saiu do documento do evento de propósito. Se voltar, volta junto o
// buraco de escrita alheia — este teste existe para o caso de alguém tentar.
await t("estranho NÃO escreve contador no documento do evento", () =>
  assertFails(updateDoc(doc(outro, "events/e4"), { participantCount: 99 })));

await env.cleanup();
console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
