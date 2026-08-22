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
  // i18next resolve `t("x", { count })` em `x_one` / `x_other`; a chave crua
  // nunca existe no arquivo, então procurar só por ela daria falso negativo.
  const existe = (k) =>
    disponiveis.has(k) || disponiveis.has(`${k}_one`) || disponiveis.has(`${k}_other`);
  const faltando = [...usadas].filter((k) => !existe(k.replace(/^events\./, "")));
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
// Comparar TODOS os pares, não só pt-BR contra en-US: um bloco copiado do
// inglês para o espanhol passava batido enquanto a prova era só de um par.
// `title` fica de fora de propósito — "Eventos" é a palavra certa em português
// e em espanhol, e exigir que difiram seria exigir uma tradução errada.
const provas = ["emptyTitle", "loading", "form.heading", "details.location"];
for (let i = 0; i < IDIOMAS.length; i += 1) {
  for (let j = i + 1; j < IDIOMAS.length; j += 1) {
    const iguais = provas.filter(
      (k) => valorDe(blocos[IDIOMAS[i]], k) === valorDe(blocos[IDIOMAS[j]], k),
    );
    check(
      `${IDIOMAS[i]} e ${IDIOMAS[j]} diferem nas frases-prova`,
      iguais.length === 0,
      iguais.join(", "),
    );
  }
}

// 5. português cravado sobrando no JSX
// Regra ESTRUTURAL, não lista de palavras.
//
// A primeira versão procurava palavras em português e só em linha que COMEÇAVA
// com maiúscula. Deixou passar duas coisas: `{count} confirmado`, porque o
// texto estava colado numa expressão, e `<h2>Sobre o Evento</h2>`, porque o
// texto estava no meio da linha. Lista de palavras sempre vai ter buraco — o
// que se procura aqui é a FORMA: texto literal dentro de JSX, em qualquer
// idioma. O que passa é o que vem de `t()`, de variável, ou de atributo.
const temLetras = /[A-Za-zÀ-ÿ]{3,}/;
const vazando = [];
for (const rel of ARQUIVOS) {
  let dentroDeImport = false;
  fs.readFileSync(path.join(ROOT, rel), "utf8")
    .split("\n")
    .forEach((linha, n) => {
      // Import de uma linha e import de várias: nos dois casos a linha do
      // `from` fecha o bloco, e nenhuma delas é conteúdo de tela.
      if (/^\s*import\s/.test(linha)) {
        dentroDeImport = !/\bfrom\b/.test(linha);
        return;
      }
      if (dentroDeImport) {
        if (/\bfrom\b/.test(linha)) dentroDeImport = false;
        return;
      }
      if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;

      const semComentarioJsx = linha.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

      // (a) nó de texto entre tags, na mesma linha: <h2>Sobre o Evento</h2>
      for (const m of semComentarioJsx.matchAll(/>([^<>{}]+)</g)) {
        if (temLetras.test(m[1])) vazando.push(`${rel}:${n + 1} >${m[1].trim().slice(0, 45)}<`);
      }
      // (b) texto colado numa expressão: `{count} confirmado`. A linha precisa
      // COMEÇAR com a expressão — é a forma que vazou de verdade, e exigir isso
      // é o que separa JSX de JS comum (`type: "all",`, `try {`, ternário em
      // className). Fica de fora o caso inverso, `Total {n}`, que a regra (a)
      // também não pega quando a tag abre numa linha e fecha noutra: guarda que
      // grita à toa é guarda que alguém desliga.
      const corpo = semComentarioJsx.trim();
      if (corpo.startsWith("{")) {
        const semExpressao = corpo.replace(/\{[^{}]*\}/g, "");
        if (!/[=`;()]/.test(semExpressao) && temLetras.test(semExpressao)) {
          vazando.push(`${rel}:${n + 1} ${corpo.slice(0, 55)}`);
        }
      }
      // (c) atributo de texto com literal. URL não se traduz — um exemplo de
      // link de grupo é o mesmo em qualquer idioma.
      const attr = semComentarioJsx.match(/(?:placeholder|title|label|alt)="([^"]{3,})"/);
      if (attr && temLetras.test(attr[1]) && !/^https?:\/\//.test(attr[1])) {
        vazando.push(`${rel}:${n + 1} ${attr[0].slice(0, 50)}`);
      }
    });
}
check(
  "nenhum texto em português cravado no JSX da feature",
  vazando.length === 0,
  vazando.slice(0, 6).join("\n         "),
);

console.log(falhas === 0 ? "\ntudo verde\n" : `\n${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
