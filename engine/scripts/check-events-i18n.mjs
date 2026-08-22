/**
 * Paridade de tradução da feature de Eventos.
 *
 * Não dá para conferir isso pela tela: o App força o idioma a partir das
 * preferências salvas (App.jsx:113), então o navegador sempre volta ao pt-BR e
 * um teste de UI passaria verde com o inglês inteiro vazio. A verificação
 * honesta lê o próprio arquivo de traduções.
 *
 *   npm run check:events-i18n
 *
 * Lê o texto em vez de importar o módulo de propósito: `i18n.js` usa imports
 * sem extensão e só tem export default, então o node não carrega direto, e
 * puxar um bundler só para um teste seria dependência nova por pouco.
 *
 * O que trava, e por quê:
 *   1. toda chave `t("events…")` usada no código existe nos 3 idiomas com bloco
 *      próprio (os outros 12 herdam de en-US);
 *   2. os 3 blocos têm exatamente o mesmo conjunto de chaves;
 *   3. pt-BR e en-US não são a mesma frase — isso pega o caso em que um bloco
 *      foi copiado sem traduzir;
 *   4. só existem 3 blocos `events`. Essa é a mais importante: na primeira
 *      tentativa os três caíram todos dentro do pt-BR, e como chave duplicada
 *      em objeto JS vence a última, o português passou a exibir espanhol
 *      enquanto inglês e espanhol ficaram sem nada.
 *   5. nada de português cravado sobrando no JSX da feature.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const IDIOMAS = ["pt-BR", "en-US", "es-ES"];
const ARQUIVOS = [
  "src/pages/Events.jsx",
  "src/pages/EventDetails.jsx",
  "src/components/EventCard.jsx",
  "src/components/CreateEventForm.jsx",
];

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? `\n         ${detalhe}` : ""}`);
  }
};

const fonte = fs.readFileSync(path.join(ROOT, "src/services/i18n.js"), "utf8");

/** Recorta um bloco `events: {` … `}` contando chaves, a partir de um índice. */
const recortar = (texto, inicio) => {
  let profundidade = 0;
  for (let i = texto.indexOf("{", inicio); i < texto.length; i += 1) {
    if (texto[i] === "{") profundidade += 1;
    else if (texto[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  throw new Error("bloco não fechou");
};

/** Chaves planificadas (`form.title`) de um bloco recortado. */
const chavesDe = (bloco) => {
  const chaves = new Set();
  const caminho = [];
  for (const linha of bloco.split("\n").slice(1)) {
    const abre = linha.match(/^\s*"?([A-Za-z0-9_-]+)"?:\s*\{\s*$/);
    if (abre) {
      caminho.push(abre[1]);
      continue;
    }
    if (/^\s*\},?\s*$/.test(linha)) {
      caminho.pop();
      continue;
    }
    const par = linha.match(/^\s*"?([A-Za-z0-9_-]+)"?:\s*"/);
    if (par) chaves.add([...caminho, par[1]].join("."));
  }
  return chaves;
};

/** Valor de uma chave planificada dentro de um bloco. */
const valorDe = (bloco, chave) => {
  const folha = chave.split(".").pop();
  const m = bloco.match(new RegExp(`^\\s*"?${folha}"?:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"));
  return m ? m[1] : undefined;
};

console.log("\nparidade da feature de Eventos\n");

// 4. quantos blocos existem, e em que idioma cada um caiu
const posicoes = [...fonte.matchAll(/^ {6}events: \{$/gm)].map((m) => m.index);
check("existem exatamente 3 blocos `events`", posicoes.length === 3, `achei ${posicoes.length}`);
if (posicoes.length !== 3) process.exit(1);

const inicioIdioma = IDIOMAS.map((lng) => fonte.indexOf(`  "${lng}": {`));
const donoDe = (pos) => {
  let dono = IDIOMAS[0];
  inicioIdioma.forEach((ini, i) => {
    if (ini >= 0 && pos > ini) dono = IDIOMAS[i];
  });
  return dono;
};
const donos = posicoes.map(donoDe);
check(
  "cada bloco caiu num idioma diferente",
  new Set(donos).size === 3,
  `donos: ${donos.join(", ")}`,
);

const blocos = {};
posicoes.forEach((pos, i) => {
  blocos[donos[i]] = recortar(fonte, pos);
});

// 1. chaves usadas no código existem nos 3 idiomas
const usadas = new Set();
for (const rel of ARQUIVOS) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of src.matchAll(/t\(\s*["'`](events\.[A-Za-z0-9_.-]+)["'`]/g)) usadas.add(m[1]);
}
// os tipos não aparecem como literal: `eventTypeLabel` monta a chave
const tipos = fs.readFileSync(path.join(ROOT, "src/services/eventTypes.js"), "utf8");
for (const m of tipos.matchAll(/^\s+"([a-z-]+)",$/gm)) usadas.add(`events.types.${m[1]}`);

check("achou as chaves de events no código", usadas.size >= 40, `achei ${usadas.size}`);

for (const lng of IDIOMAS) {
  const disponiveis = chavesDe(blocos[lng]);
  const faltando = [...usadas].filter((k) => !disponiveis.has(k.replace(/^events\./, "")));
  check(
    `${lng}: as ${usadas.size} chaves usadas existem`,
    faltando.length === 0,
    faltando.slice(0, 6).join(", "),
  );
}

// 2. mesmo conjunto de chaves nos 3
const conjuntos = IDIOMAS.map((l) => chavesDe(blocos[l]));
for (let i = 1; i < IDIOMAS.length; i += 1) {
  const soPt = [...conjuntos[0]].filter((k) => !conjuntos[i].has(k));
  const soOutro = [...conjuntos[i]].filter((k) => !conjuntos[0].has(k));
  check(
    `${IDIOMAS[i]} tem exatamente as mesmas chaves de pt-BR`,
    soPt.length === 0 && soOutro.length === 0,
    `só em pt-BR: ${soPt.slice(0, 5)} | só em ${IDIOMAS[i]}: ${soOutro.slice(0, 5)}`,
  );
}

// 3. frases-prova precisam mesmo mudar de idioma
const provas = ["title", "emptyTitle", "loading", "form.heading", "details.location"];
const iguais = provas.filter(
  (k) => valorDe(blocos["pt-BR"], k) === valorDe(blocos["en-US"], k),
);
check("pt-BR e en-US diferem nas frases-prova", iguais.length === 0, iguais.join(", "));

// 5. português cravado sobrando no JSX
const SUSPEITO = /(Evento|Criar|Filtros|Nenhum|Carregando|Cadastrar|Presen|Selecione|Cidade|Endere|Visualiza)/;
const vazando = [];
for (const rel of ARQUIVOS) {
  fs.readFileSync(path.join(ROOT, rel), "utf8")
    .split("\n")
    .forEach((linha, n) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
      if (/t\(|import |from "|key=|className/.test(linha)) return;
      const jsx = linha.match(/^\s*([A-ZÀ-Ú][^<>{}]{3,})\s*$/);
      const attr = linha.match(/(?:placeholder|title|label)="([^"]{4,})"/);
      const alvo = jsx?.[1] || attr?.[1];
      if (alvo && SUSPEITO.test(alvo)) vazando.push(`${rel}:${n + 1} ${alvo.trim().slice(0, 40)}`);
    });
}
check(
  "nenhum texto em português cravado no JSX da feature",
  vazando.length === 0,
  vazando.slice(0, 6).join("\n         "),
);

console.log(falhas === 0 ? "\ntudo verde\n" : `\n${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
