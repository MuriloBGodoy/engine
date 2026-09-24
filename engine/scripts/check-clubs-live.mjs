/**
 * O que existe de Clubes NO BANCO DE PRODUÇÃO, lido pelas mesmas consultas
 * que a descoberta faz.
 *
 *   node scripts/check-clubs-live.mjs
 *
 * Serve para uma pergunta que a tela não responde: quando a descoberta vem
 * vazia, é porque não há clube, porque a regra negou, ou porque o índice
 * composto ainda não terminou de construir? Os três casos são a mesma tela
 * ("nenhum clube"), e só o primeiro é ausência de verdade. Um índice em
 * construção estoura aqui com FAILED_PRECONDITION, nomeando qual.
 *
 * Leitura apenas, com a conta de serviço — que ignora as regras. Portanto
 * isto prova que o DADO está lá, não que um usuário comum consegue lê-lo;
 * para regra, o que vale é `scripts/check-club-rules.mjs` contra o emulador.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const sa = JSON.parse(fs.readFileSync("C:/engine-credentials/service-account.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// A consulta que a descoberta faz de verdade: se o índice não estiver pronto,
// isto estoura com failed-precondition em vez de devolver lista.
const snap = await db
  .collection("clubs")
  .where("archived", "==", false)
  .orderBy("memberCount", "desc")
  .get();

console.log("clubes lidos pela consulta da descoberta:", snap.size);
for (const d of snap.docs) {
  const c = d.data();
  console.log(
    "  ",
    String(c.tag).padEnd(5),
    String(c.name).padEnd(24),
    `${c.city}/${c.state}`.padEnd(20),
    "membros:", c.memberCount,
    "| oficial:", c.official,
  );
}

const porEstilo = await db
  .collection("clubs")
  .where("archived", "==", false)
  .where("focus.styles", "array-contains", "jdm")
  .orderBy("memberCount", "desc")
  .get();
console.log("consulta por estilo (jdm):", porEstilo.size);

const tags = await db.collection("clubTags").get();
console.log("siglas registradas:", tags.size);

const feat = await db.doc("featured/clubOfWeek").get();
console.log("clube da semana:", feat.exists ? feat.data().clubId : "(nenhum)");

const membros = await db.collection("clubs").doc(snap.docs[0].id).collection("members").get();
console.log(`membros do primeiro clube (${snap.docs[0].id}):`, membros.size,
  membros.docs.map((m) => m.data().role).join(", "));
