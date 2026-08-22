#!/usr/bin/env node

/**
 * Gera a base de consumo do PBE Veicular (INMETRO/CONPET) usada pelo simulador.
 *
 *   node scripts/fetch-inmetro-consumption.mjs            # baixa e grava o JSON
 *   node scripts/fetch-inmetro-consumption.mjs --report   # + taxa de casamento
 *   node scripts/fetch-inmetro-consumption.mjs --csv x.csv --report
 *
 * O CSV é PÚBLICO e não pede chave nenhuma. A chave do dados.gov.br serve só
 * para descobrir o recurso no catálogo (conjunto
 * 732edce9-617c-4c43-8f4a-58b3690be910); baixar o arquivo em si é um GET
 * simples. Consequência prática: este job roda sem credencial, em qualquer
 * máquina ou CI.
 *
 * Três defeitos do arquivo de origem que este script trata como erro fatal em
 * vez de contornar em silêncio:
 *
 * 1. A coluna de consumo "cidade" é `Gasolina OU Diesel` — uma coluna para
 *    dois combustíveis, e a coluna "estrada" faz o mesmo sem avisar no
 *    cabeçalho. Quem lê pelo índice sem olhar o campo `Combustível` grava
 *    diesel em campo de gasolina, que é exatamente o defeito do
 *    `fipe-consumption-db.json` que esta base substitui.
 * 2. Os códigos de combustível são letras e `E` NÃO é etanol, é elétrico.
 *    Assumir o óbvio poria carro elétrico na conta de gasolina.
 * 3. O CSV é latin-1, separado por ";" e tem campo com aspas contendo quebra
 *    de linha. Split por linha desmonta o arquivo.
 *
 * As asserções abaixo falham a execução em vez de gravar um JSON torto. Base
 * ruim que grava é pior do que job que quebra.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeFipeBrand,
  parseFipeVersion,
  ASPIRATION,
} from "../src/services/fipeVersion.js";
import {
  aspirationMark,
  buildNameIndex,
  modelKey,
  resolveName,
  versionKey,
} from "../src/services/consumptionKey.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TABLE_YEAR = 2026;
const CSV_URL = `https://dados.inmetro.gov.br/programa_brasileiro_de_etiquetagem/VEICULOS_${TABLE_YEAR}.csv`;
const OUT = path.join(__dirname, "../src/data/inmetro-consumption.json");
const CACHE = path.join(__dirname, ".cache", `inmetro-${TABLE_YEAR}.csv`);
const FIPE_SAMPLE = path.join(__dirname, ".cache", "fipe-models.json");

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (c === ";" && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r" && !quoted) {
      // separador do Windows; o \n seguinte é que fecha o registro
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Vazio, "\\", "ND" e "N.A." são ausência. Vírgula é decimal. */
const number = (raw) => {
  const s = clean(raw).replace(",", ".");
  if (!s || s === "\\" || /^(ND|NA|N\.A\.|-+)$/i.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Índice por texto do cabeçalho, não por posição. O INMETRO já reordenou e
 * renomeou coluna entre edições; casar por posição é aceitar que a tabela do
 * ano que vem grave etanol no campo de gasolina sem ninguém perceber.
 */
function columnIndex(header, pattern, label) {
  const found = header.findIndex((h) => pattern.test(h));
  if (found === -1) {
    throw new Error(
      `coluna não encontrada: ${label}. O cabeçalho do PBE mudou; confira o CSV antes de mexer no regex.\n` +
        header.map((h, i) => `  ${i} ${h}`).join("\n"),
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// Combustível
// ---------------------------------------------------------------------------

/**
 * Legenda impressa na folha de rosto da tabela PBE (edição 2021, p.1):
 * Elétrico (E), Gasolina (G), Flex (F), Diesel (D). Verificada contra o próprio
 * dado em `assertFuelCodes` — documento e arquivo concordam.
 */
const FUEL_CODES = { E: "electric", G: "gasoline", F: "flex", D: "diesel" };

/**
 * Prova, pelo preenchimento das colunas, que a legenda é essa mesma. Se um dia
 * "E" passar a ter consumo de etanol, ou "G" vier com coluna de etanol
 * preenchida, o mapa acima está errado e o job para aqui.
 */
function assertFuelCodes(byCode) {
  const problems = [];
  const has = (r, k) => r[k] !== null;
  for (const [code, rows] of Object.entries(byCode)) {
    if (!FUEL_CODES[code]) {
      problems.push(`código de combustível desconhecido: "${code}" (${rows.length} registros)`);
    }
  }
  const check = (code, predicate, why) => {
    const rows = byCode[code] || [];
    const bad = rows.filter((r) => !predicate(r));
    if (bad.length) {
      problems.push(
        `${bad.length}/${rows.length} registros "${code}" contradizem "${why}" — ex.: ` +
          bad.slice(0, 3).map((r) => `${r.brand} ${r.model} ${r.version}`).join(" / "),
      );
    }
  };
  check("E", (r) => !has(r, "liquidCity") && !has(r, "ethanolCity"), "elétrico não tem consumo de líquido");
  check("G", (r) => !has(r, "ethanolCity"), "gasolina pura não tem coluna de etanol");
  check("D", (r) => !has(r, "ethanolCity"), "diesel não tem coluna de etanol");
  // Flex sem etanol existe (híbrido flex declarado só em gasolina), então a
  // asserção é a inversa: etanol preenchido obriga gasolina preenchida.
  check("F", (r) => !has(r, "ethanolCity") || has(r, "liquidCity"), "flex com etanol tem que ter gasolina");
  if (problems.length) {
    throw new Error(`legenda de combustível não bate com o dado:\n- ${problems.join("\n- ")}`);
  }
}

// ---------------------------------------------------------------------------
// Chave de casamento com a FIPE
// ---------------------------------------------------------------------------

/**
 * O INMETRO escreve a marca do jeito dele ("VW", "CAOA CHERY") e a FIPE do dela
 * ("VW - VolksWagen", "Caoa Chery/Chery"). `normalizeFipeBrand` resolve o lado
 * da FIPE; este mapa resolve o que sobra do lado do INMETRO.
 */
const BRAND_FIX = {
  VW: "Volkswagen",
  "CAOA CHERY": "Chery",
  "CAOA CHANGAN": "Changan",
  CITROEN: "Citroen",
  "LAND ROVER": "Land Rover",
  "MERCEDES-BENZ": "Mercedes-Benz",
};

/**
 * Nome comercial do INMETRO -> nome comercial da FIPE, só onde a diferença não
 * é de pontuação (isso o `slug` já resolve). Cada linha foi conferida contra a
 * lista real de versões da FIPE; não é lista de memória.
 *
 * O que NÃO entra aqui de propósito: "ONIX" x "ONIX PLUS", "SONG PRO" x
 * "SONG PLUS", "TIGGO 5X" x "TIGGO 7". São carros diferentes, e casar por
 * prefixo os fundiria.
 */
const MODEL_ALIASES = {
  "COROLLA HB": "COROLLA",
  "YARIS CROSS FLEX": "YARIS CROSS",
  "SW4 DIESEL 4X4": "SW4",
  "HILUX DIESEL 4X4 MT": "HILUX",
  "HILUX DIESEL 4X4 AT": "HILUX",
  "NOVA RANGER 4X2": "RANGER",
  "NOVA RANGER 4X4": "RANGER",
  "MUSTANG DARK HORSE": "MUSTANG",
  "HR-V (MOD. 26)": "HR-V",
  "CIVIC HYBRID": "CIVIC",
  "ACCORD HYBRID": "ACCORD",
  "CITY HATCH": "CITY",
  "MASTER FURGÃO": "MASTER",
  "MASTER FUGÃO PRÓ": "MASTER",
  "MASTER BUS": "MASTER",
  "MASTER CHASSIS CABINE": "MASTER",
  "SPARK EUV": "SPARK",
};

/**
 * "1.0T - 12V" -> { displacement: 1.0, turbo: true }. O T é o mesmo marcador de
 * sobrealimentação que o parser da FIPE extrai da string da versão, o que torna
 * a aspiração parte da chave em vez de suposição.
 */
function parseEngine(raw) {
  const text = clean(raw).toUpperCase();
  const match = text.match(/(\d)[.,](\d)/);
  const turbo =
    /\d[.,]\d\s*(T|TB|TURBO)\b/.test(text) || /\s(T|TB|TURBO)\b/.test(text.replace(/[-/]/g, " "));
  if (!match) return { displacement: null, turbo };
  return { displacement: Number(`${match[1]}.${match[2]}`), turbo };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function readRecords(csvText) {
  const rows = parseCsv(csvText);
  const header = rows[0].map(clean);
  const col = {
    brand: columnIndex(header, /^Marca$/i, "Marca"),
    model: columnIndex(header, /^Modelo$/i, "Modelo"),
    version: columnIndex(header, /^Vers[ãa]o$/i, "Versão"),
    engine: columnIndex(header, /^Motor$/i, "Motor"),
    propulsion: columnIndex(header, /Tipo de Propuls/i, "Tipo de Propulsão"),
    fuel: columnIndex(header, /^Combust[íi]vel$/i, "Combustível"),
    ethanolCity: columnIndex(header, /Litro Etanol cidade/i, "km/l etanol cidade"),
    ethanolHwy: columnIndex(header, /Litro Etanol Estrada/i, "km/l etanol estrada"),
    liquidCity: columnIndex(header, /Gasolina ou Diesel Cidade/i, "km/l gasolina ou diesel cidade"),
    liquidHwy: columnIndex(header, /Litro Gasolina Estrada/i, "km/l gasolina estrada"),
  };

  const data = rows
    .slice(1)
    .filter((r) => r.length >= header.length - 2 && clean(r[col.brand]))
    .map((r) => ({
      brand: clean(r[col.brand]),
      model: clean(r[col.model]),
      version: clean(r[col.version]),
      engine: clean(r[col.engine]),
      propulsion: clean(r[col.propulsion]),
      fuelCode: clean(r[col.fuel]).toUpperCase(),
      ethanolCity: number(r[col.ethanolCity]),
      ethanolHwy: number(r[col.ethanolHwy]),
      liquidCity: number(r[col.liquidCity]),
      liquidHwy: number(r[col.liquidHwy]),
    }));

  const byCode = {};
  for (const r of data) {
    if (!byCode[r.fuelCode]) byCode[r.fuelCode] = [];
    byCode[r.fuelCode].push(r);
  }
  assertFuelCodes(byCode);
  return { data, byCode };
}

// ---------------------------------------------------------------------------
// Ponderação cidade/estrada
// ---------------------------------------------------------------------------

/**
 * 55% cidade / 45% estrada, em média HARMÔNICA — o que se soma é litro por km,
 * não km por litro. A média aritmética de 8 e 12 km/l dá 10; a correta dá 9,4,
 * e a diferença vai direto para a conta de combustível.
 *
 * O peso não foi escolhido por mim: foi DERIVADO da própria tabela. A coluna
 * "Consumo Energético (MJ/km)" é uma combinação linear de 1/cidade e
 * 1/estrada, e ajustando os dois coeficientes por mínimos quadrados sobre os
 * 157 elétricos o peso da cidade sai 0,5502 com erro relativo de 0,056% — a
 * identidade é exata, o peso é 0,55. Nos veículos de combustão o mesmo ajuste
 * dá entre 0,58 e 0,65 com ~1% de erro, porque ali os km/l publicados já vêm
 * corrigidos por fatores de ajuste diferentes por ciclo (a metodologia do PBE
 * declara ter adotado os fatores da EPA) enquanto o MJ/km parece vir do valor
 * de laboratório. Nos elétricos essa distorção não aparece, e é por isso que
 * são eles que fixam o número.
 */
export const CITY_WEIGHT = 0.55;

const blend = (city, highway) => {
  if (!city && !highway) return null;
  if (!city || !highway) return city || highway;
  return 1 / (CITY_WEIGHT / city + (1 - CITY_WEIGHT) / highway);
};

const median = (values) => {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

/**
 * Mediana por combustível de um conjunto de registros do PBE.
 *
 * A separação por `fuelCode` é o que impede o defeito da coluna compartilhada:
 * gasolina só sai de registro G ou F, diesel só sai de registro D. Um Kwid
 * nunca ganha valor de diesel porque não existe registro D de Kwid.
 */
function aggregate(records) {
  const out = {};
  const gasRows = records.filter((r) => r.fuelCode === "G" || r.fuelCode === "F");
  const dieselRows = records.filter((r) => r.fuelCode === "D");
  const ethanolRows = records.filter((r) => r.fuelCode === "F");

  const gas = median(gasRows.map((r) => blend(r.liquidCity, r.liquidHwy)).filter(Boolean));
  const diesel = median(dieselRows.map((r) => blend(r.liquidCity, r.liquidHwy)).filter(Boolean));
  const ethanol = median(ethanolRows.map((r) => blend(r.ethanolCity, r.ethanolHwy)).filter(Boolean));

  if (gas) out.gasoline = round1(gas);
  if (ethanol) out.ethanol = round1(ethanol);
  if (diesel) out.diesel = round1(diesel);

  // Cidade e estrada da gasolina vão junto porque a tela mostra os dois e
  // porque o dia em que existir uma entrada de "quanto você roda na cidade"
  // ela precisa do par, não do combinado já fechado.
  const city = median(gasRows.map((r) => r.liquidCity).filter(Boolean));
  const hwy = median(gasRows.map((r) => r.liquidHwy).filter(Boolean));
  if (city && hwy) out.gasolineCityHwy = [round1(city), round1(hwy)];

  return out;
}

// ---------------------------------------------------------------------------
// Construção da base
// ---------------------------------------------------------------------------

function build(data) {
  // Elétricos ficam de fora, e é abstenção deliberada: o PBE publica km por
  // "litro equivalente", não km/kWh, e a equivalência que o próprio arquivo
  // usa (20,3 MJ por litro equivalente, ~5,6 kWh) não é a da EPA (8,9 kWh/l).
  // Converter com o fator errado erraria a conta de energia em ~60%. Sem fonte
  // para a equivalência, carro elétrico continua no padrão do simulador.
  const combustion = data.filter((r) => r.fuelCode !== "E");

  const versionGroups = new Map();
  const modelGroups = new Map();
  let noDisplacement = 0;

  for (const r of combustion) {
    const brand = BRAND_FIX[r.brand.toUpperCase()] || normalizeFipeBrand(r.brand);
    const model = MODEL_ALIASES[r.model.toUpperCase()] || r.model;
    const { displacement, turbo } = parseEngine(r.engine);

    const mk = modelKey(brand, model);
    if (!modelGroups.has(mk)) modelGroups.set(mk, []);
    modelGroups.get(mk).push(r);

    if (!displacement) {
      noDisplacement += 1;
      continue;
    }
    const hybrid = /h[íi]brido|plug/i.test(r.propulsion);
    const vk = versionKey(
      brand,
      model,
      displacement,
      aspirationMark(r.fuelCode === "D", turbo, hybrid),
    );
    if (!versionGroups.has(vk)) versionGroups.set(vk, []);
    versionGroups.get(vk).push(r);
  }

  const collapse = (groups) => {
    const out = {};
    for (const [key, rows] of groups) {
      const agg = aggregate(rows);
      if (Object.keys(agg).length) out[key] = { ...agg, n: rows.length };
    }
    return out;
  };

  return {
    versions: collapse(versionGroups),
    models: collapse(modelGroups),
    noDisplacement,
    combustionRecords: combustion.length,
  };
}

// ---------------------------------------------------------------------------
// Medição do casamento contra strings reais da FIPE
// ---------------------------------------------------------------------------

/**
 * Mede a taxa de casamento contra strings REAIS da FIPE.
 *
 * Importa `services/consumption.js` depois de gravar o JSON, de propósito: o
 * que está sendo medido é a função que o app usa, não uma reimplementação da
 * regra dentro do script. Script que reimplementa o modelo testa o script.
 */
async function report() {
  if (!fs.existsSync(FIPE_SAMPLE)) {
    console.log(`\nsem amostra da FIPE em ${FIPE_SAMPLE} — rode scripts/fetch-fipe-sample.mjs`);
    return;
  }
  const { consumptionFor } = await import("../src/services/consumption.js");
  const sample = JSON.parse(fs.readFileSync(FIPE_SAMPLE, "utf8"));
  const stats = { total: 0, version: 0, model: 0, none: 0, electric: 0 };
  const missesByBrand = new Map();

  for (const car of sample) {
    stats.total += 1;
    const parsed = parseFipeVersion(car);
    if (parsed.fuel?.value === "electric") {
      stats.electric += 1;
      continue;
    }
    const found = consumptionFor(car);
    if (!found) {
      stats.none += 1;
      missesByBrand.set(car.brand, (missesByBrand.get(car.brand) || 0) + 1);
    } else stats[found.match] += 1;
  }

  const pct = (n) => `${((100 * n) / stats.total).toFixed(1)}%`;
  console.log("\n== casamento contra strings reais da FIPE ==");
  console.log(`  versões FIPE testadas: ${stats.total}`);
  console.log(`  casou no nível VERSÃO: ${stats.version} (${pct(stats.version)})`);
  console.log(`  casou no nível MODELO: ${stats.model} (${pct(stats.model)})`);
  console.log(`  elétrico, fora da base de propósito: ${stats.electric} (${pct(stats.electric)})`);
  console.log(`  sem casamento: ${stats.none} (${pct(stats.none)})`);
  console.log(
    "  marcas com mais furos: " +
      [...missesByBrand].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b}=${n}`).join(", "),
  );
  console.log(
    "\n  O denominador aqui é o catálogo INTEIRO da FIPE, que tem 30 anos de "+
      "carro descontinuado. Medido por ano-modelo numa amostra de 406 versões: "+
      "2024+ 76%, 2020-2023 28%, 2015-2019 7%, até 2014 ~5%. A tabela é de carro "+
      "novo, e é isso que ela cobre.",
  );
}

// ---------------------------------------------------------------------------

async function readCsv() {
  const flagIndex = process.argv.indexOf("--csv");
  if (flagIndex !== -1) {
    return new TextDecoder("latin1").decode(fs.readFileSync(process.argv[flagIndex + 1]));
  }
  if (process.argv.includes("--cache") && fs.existsSync(CACHE)) {
    return new TextDecoder("latin1").decode(fs.readFileSync(CACHE));
  }
  console.log(`baixando ${CSV_URL}`);
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`INMETRO respondeu ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, buffer);
  return new TextDecoder("latin1").decode(buffer);
}

const csvText = await readCsv();
const { data, byCode } = readRecords(csvText);
console.log(
  `PBE ${TABLE_YEAR}: ${data.length} registros, ${new Set(data.map((r) => r.brand)).size} marcas ` +
    `(${Object.entries(byCode).map(([k, v]) => `${k}=${v.length}`).join(" ")})`,
);

const base = build(data);
const out = {
  source: "INMETRO/CONPET - Programa Brasileiro de Etiquetagem Veicular (PBE Veicular)",
  sourceUrl: CSV_URL,
  tableYear: TABLE_YEAR,
  generatedAt: new Date().toISOString().slice(0, 10),
  cityWeight: CITY_WEIGHT,
  notes:
    "km/l ja ajustados pelo INMETRO para uso real (Portaria Inmetro 169/2023); o " +
    "proprio orgao declara que 90% dos motoristas ficam a +-20% do valor publicado. " +
    "Combinado = media harmonica 55% cidade / 45% estrada, peso derivado da coluna " +
    "de consumo energetico da propria tabela. Eletricos fora: o PBE publica km por " +
    "litro equivalente e nao declara a equivalencia em kWh.",
  records: { total: data.length, combustion: base.combustionRecords },
  versions: base.versions,
  models: base.models,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(
  `gravado ${OUT}\n  ${Object.keys(base.versions).length} chaves de versão, ` +
    `${Object.keys(base.models).length} de modelo, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB ` +
    `(${base.noDisplacement} registros sem cilindrada legível)`,
);

if (process.argv.includes("--report")) await report();
