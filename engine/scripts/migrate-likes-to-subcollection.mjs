/**
 * Migração única: curtida sai do mapa `likesBy` e vira documento na subcoleção
 * `communityGoals/{id}/likes/{uid}`.
 *
 *   node scripts/migrate-likes-to-subcollection.mjs            # simulação
 *   node scripts/migrate-likes-to-subcollection.mjs --aplicar  # escreve
 *
 * Precisa da credencial de administrador, que mora FORA do repositório:
 *   C:\engine-credentials\service-account.json
 * (ou o caminho em GOOGLE_APPLICATION_CREDENTIALS / ENGINE_SERVICE_ACCOUNT)
 *
 * Por que existe: o mapa `likesBy` vivia dentro do documento do post, e
 * documento no Firestore tem teto de 1 MiB dividido com os comentários — medido
 * em 22/08/2026, o post travava em ~16.900 curtidas e em ~2.800 quando tinha
 * 2.000 comentários. Quanto mais viral, menor o teto.
 *
 * Por que rodar ANTES de o código novo subir: o leitor prefere `likesCount`
 * quando ele existe. Se alguém curtir um post antigo antes da migração, o
 * `increment(1)` cria `likesCount: 1` e as curtidas antigas somem da tela.
 *
 * É ADITIVA e idempotente: cria os documentos de curtida, acerta `likesCount`
 * contando a subcoleção, e NÃO apaga `likesBy`. A limpeza do mapa é um segundo
 * passo, depois de a migração estar confirmada — assim dá para voltar atrás.
 */
import fs from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APLICAR = process.argv.includes("--aplicar");

const CAMINHOS = [
  process.env.ENGINE_SERVICE_ACCOUNT,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  "C:\\engine-credentials\\service-account.json",
].filter(Boolean);

const credencial = CAMINHOS.find((p) => fs.existsSync(p));
if (!credencial) {
  console.error(
    "Credencial de administrador não encontrada. Procurei em:\n  " +
      CAMINHOS.join("\n  ") +
      "\nEla fica fora do repositório de propósito — ver engine-api/src/main/resources/README.",
  );
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(credencial, "utf8"))) });
const db = getFirestore();

console.log(
  `\n${APLICAR ? "APLICANDO" : "SIMULAÇÃO (nada será escrito)"} · credencial: ${path.basename(credencial)}\n`,
);

const posts = await db.collection("communityGoals").get();
let curtidasCriadas = 0;
let contadoresAcertados = 0;
let postsTocados = 0;

for (const post of posts.docs) {
  const dados = post.data();
  const doMapa = Object.keys(dados.likesBy || {});
  const subcolecao = await post.ref.collection("likes").get();
  const jaMigrados = new Set(subcolecao.docs.map((d) => d.id));
  const faltando = doMapa.filter((uid) => !jaMigrados.has(uid));

  // O total certo é o que a subcoleção vai ter no fim, não o tamanho do mapa:
  // se alguém já curtiu pelo caminho novo, essa curtida não está no mapa.
  const totalFinal = jaMigrados.size + faltando.length;
  const contadorErrado = dados.likesCount !== totalFinal;

  if (!faltando.length && !contadorErrado) continue;
  postsTocados += 1;

  console.log(
    `  ${post.id}  mapa:${doMapa.length} subcoleção:${jaMigrados.size} ` +
      `→ criar ${faltando.length}, likesCount ${dados.likesCount ?? "(ausente)"} → ${totalFinal}`,
  );

  if (!APLICAR) {
    curtidasCriadas += faltando.length;
    if (contadorErrado) contadoresAcertados += 1;
    continue;
  }

  const lote = db.batch();
  for (const uid of faltando) {
    lote.set(post.ref.collection("likes").doc(uid), {
      likerId: uid,
      postOwnerId: dados.ownerId || "",
      createdAt: dados.createdAt || FieldValue.serverTimestamp(),
      migradoDoMapa: true,
    });
  }
  if (contadorErrado) lote.update(post.ref, { likesCount: totalFinal });
  await lote.commit();

  curtidasCriadas += faltando.length;
  if (contadorErrado) contadoresAcertados += 1;
}

console.log(
  `\nposts: ${posts.size} · tocados: ${postsTocados} · ` +
    `curtidas ${APLICAR ? "criadas" : "a criar"}: ${curtidasCriadas} · ` +
    `contadores ${APLICAR ? "acertados" : "a acertar"}: ${contadoresAcertados}`,
);
console.log(
  APLICAR
    ? "\n`likesBy` foi mantido de propósito. Apagar só depois de conferir.\n"
    : "\nRode de novo com --aplicar para escrever.\n",
);
process.exit(0);
