/**
 * Baixa as regras do Firestore que estão PUBLICADAS no projeto, para comparar
 * com o `firestore.rules` do repo antes de um deploy.
 *
 *   node scripts/fetch-published-rules.mjs [destino.rules]
 *
 * Por que isto existe: `firebase deploy --only firestore:rules` **sobrescreve**
 * sem avisar o que estava lá. Se alguém tiver editado a regra pelo console da
 * web, o deploy apaga essa edição em silêncio. Em agosto/2026 a comparação foi
 * feita antes de publicar as regras de `events` e deu zero linhas só-no-console
 * — mas isso foi um resultado, não uma garantia para sempre.
 *
 * A CLI não expõe "buscar regra publicada" (só `firestore:indexes`), então vai
 * pela API de Rules, autenticando com a mesma conta de serviço do seed. Só
 * leitura: `releases/cloud.firestore` diz qual ruleset está no ar, e
 * `rulesets/{id}` traz a fonte.
 */
import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const CREDENCIAL = process.env.ENGINE_SERVICE_ACCOUNT || "C:/engine-credentials/service-account.json";
const destino = process.argv[2] || "";

if (!fs.existsSync(CREDENCIAL)) {
  console.error(`Credencial não encontrada em ${CREDENCIAL}.`);
  console.error("Defina ENGINE_SERVICE_ACCOUNT com o caminho do service-account.json.");
  process.exit(1);
}

const conta = JSON.parse(fs.readFileSync(CREDENCIAL, "utf8"));
const projeto = conta.project_id;

const auth = new GoogleAuth({
  keyFile: CREDENCIAL,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const cliente = await auth.getClient();
const { token } = await cliente.getAccessToken();

const pegar = async (url) => {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) {
    throw new Error(`${resposta.status} ${resposta.statusText} — ${await resposta.text()}`);
  }
  return resposta.json();
};

const base = "https://firebaserules.googleapis.com/v1";
const release = await pegar(`${base}/projects/${projeto}/releases/cloud.firestore`);
const rulesetId = String(release.rulesetName || "").split("/").pop();
const ruleset = await pegar(`${base}/projects/${projeto}/rulesets/${rulesetId}`);

const arquivos = ruleset.source?.files || [];
if (arquivos.length !== 1) {
  console.warn(`Atenção: o ruleset publicado tem ${arquivos.length} arquivos.`);
}
const fonte = arquivos.map((f) => f.content).join("\n");

console.log(`projeto:   ${projeto}`);
console.log(`ruleset:   ${rulesetId}`);
console.log(`criado em: ${ruleset.createTime}`);
console.log(`linhas:    ${fonte.split("\n").length}`);

if (destino) {
  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
  fs.writeFileSync(destino, fonte, "utf8");
  console.log(`salvo em:  ${destino}`);
} else {
  console.log("\n--- fonte publicada ---\n");
  console.log(fonte);
}
