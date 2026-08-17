#!/usr/bin/env node

/**
 * Verificação do parser de versão FIPE.
 *
 * Duas partes, e as duas importam:
 *
 * 1. ASSERTIVAS — inclusive as de "carro impossível". Se o parser produzir um
 *    Mobi turbo, um Crossfox 1.6 turbo ou um Compass 1.3 aspirado, ele está
 *    errado, mesmo que nenhum schema reclame. Essa checagem existe como teste,
 *    não como comentário.
 *
 * 2. COBERTURA MEDIDA — roda contra a amostra real baixada por
 *    `fetch-fipe-sample.mjs` e reporta, por campo, quantos por cento extrai.
 *    Ler o próprio regex e achar que está bom não é medição.
 *
 * Uso:
 *   node scripts/fetch-fipe-sample.mjs
 *   node scripts/check-fipe-parser.mjs [amostra.json]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseFipeVersion,
  parseFipeYear,
  normalizeFipeBrand,
  CONFIDENCE,
  ASPIRATION,
  FUEL,
  TRANSMISSION,
  AMBIGUITY,
  versionGroupKey,
} from "../src/services/fipeVersion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`FALHOU  ${label}\n        esperado ${JSON.stringify(expected)}\n        obtido   ${JSON.stringify(actual)}`);
  }
  return ok;
};

const val = (f) => (f ? f.value : null);
const conf = (f) => (f ? f.confidence : null);

// ---------------------------------------------------------------------------
// 1. Assertivas
// ---------------------------------------------------------------------------

console.log("== assertivas ==\n");

// --- marca ---
check("marca GM", normalizeFipeBrand("GM - Chevrolet"), "Chevrolet");
check("marca VW", normalizeFipeBrand("VW - VolksWagen"), "Volkswagen");
check("marca Kia", normalizeFipeBrand("Kia Motors"), "Kia");
check("marca Chery", normalizeFipeBrand("Caoa Chery/Chery"), "Chery");
check("marca simples", normalizeFipeBrand("Fiat"), "Fiat");

// --- ano ---
check("ano flex", parseFipeYear("2022 Flex"), {
  modelYear: 2022,
  yearFuel: FUEL.FLEX,
  isZeroKm: false,
});
check("ano zero km", parseFipeYear("32000 Gasolina"), {
  modelYear: null,
  yearFuel: FUEL.GASOLINE,
  isZeroKm: true,
});
check("ano híbrido", parseFipeYear("2024 Híbrido"), {
  modelYear: 2024,
  yearFuel: FUEL.HYBRID,
  isZeroKm: false,
});

// --- caso canônico ---
{
  const p = parseFipeVersion({
    brand: "GM - Chevrolet",
    model: "ONIX HATCH LT 1.0 12V TB Flex 5p Aut.",
    year: "2022 Gasolina",
  });
  check("onix turbo: cilindrada", val(p.displacement), 1.0);
  check("onix turbo: válvulas", val(p.valves), 12);
  check("onix turbo: aspiração", val(p.aspiration), ASPIRATION.TURBO);
  check("onix turbo: aspiração explícita", conf(p.aspiration), CONFIDENCE.EXPLICIT);
  // A regra que alguém vai querer "consertar": ano diz Gasolina, nome diz Flex.
  // Flex ganha, porque o campo de ano da FIPE é um balde de quatro posições.
  check("onix turbo: combustível", val(p.fuel), FUEL.FLEX);
  check("onix turbo: câmbio", val(p.transmission), TRANSMISSION.AUTOMATIC);
  check("onix turbo: portas", val(p.body.doors), 5);
  check("onix turbo: nome", val(p.nameplate), "ONIX HATCH");
  check("onix turbo: trim", val(p.trim), "LT");
  check("onix turbo: marca", val(p.brand), "Chevrolet");
  check("onix turbo: chave confiável", p.engineKey?.confident, true);
  check("onix turbo: chave", p.engineKey?.key, "chevrolet|1.0|12|turbo|flex");
}

// O irmão sem `TB`: mesma cilindrada, mesmas válvulas, e a FIPE lista neste
// mesmo grupo tanto versões turbo quanto aspiradas — inclusive turbos SEM
// marcador (`ONIX HATCH 100 Anos 1.0 12V 5p Mec.` é 2025, ano em que o Onix
// aspirado já não existia). Aqui não dá para saber, então o parser se abstém.
// Um "não sabemos" é uma feature pronta; 82 cv num carro de 116 não é.
{
  const p = parseFipeVersion({
    brand: "GM - Chevrolet",
    model: "ONIX HATCH LT 1.0 12V Flex 5p Mec.",
    year: "2022 Gasolina",
  });
  check("onix sem TB: aspiração desconhecida", p.aspiration, null);
  check(
    "onix sem TB: grupo ambíguo registrado",
    p.ambiguities.includes(AMBIGUITY.AMBIGUOUS_ASPIRATION_GROUP),
    true,
  );
  check("onix sem TB: sem chave de motor", p.engineKey, null);
  check("onix sem TB: câmbio continua legível", val(p.transmission), TRANSMISSION.MANUAL);
  check("onix sem TB: cilindrada continua legível", val(p.displacement), 1.0);
}

// Já onde a FIPE nunca listou um irmão turbo, a inferência de aspirado é
// defensável — e sai marcada como inferência, não como leitura.
{
  const p = parseFipeVersion({
    brand: "Renault",
    model: "KWID Zen 1.0 Flex 12V 5p Mec.",
    year: "2024 Flex",
  });
  check("kwid: aspirado inferido", val(p.aspiration), ASPIRATION.NATURAL);
  check("kwid: confiança é inferida", conf(p.aspiration), CONFIDENCE.INFERRED);
  check(
    "kwid: ambiguidade de marcador registrada",
    p.ambiguities.includes(AMBIGUITY.UNMARKED_ASPIRATION),
    true,
  );
  check("kwid: chave existe mas não é confiável", p.engineKey?.confident, false);
}

// ---------------------------------------------------------------------------
// Carros impossíveis — o detector que nenhum schema pega
// ---------------------------------------------------------------------------

console.log("-- carros impossíveis --");

// `T. Flex` é TOTAL FLEX, não turbo. Crossfox 1.6 turbo nunca existiu.
{
  const p = parseFipeVersion({
    brand: "VW - VolksWagen",
    model: "CROSSFOX  1.6 T. Flex 16V 5p",
    year: "2012 Flex",
  });
  check("crossfox NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("crossfox: cilindrada", val(p.displacement), 1.6);
  check("crossfox: combustível", val(p.fuel), FUEL.FLEX);
}
{
  const p = parseFipeVersion({
    brand: "VW - VolksWagen",
    model: "Gol Comfortline 1.0 T. Flex 12V 5p",
    year: "2015 Flex",
  });
  check("gol T.Flex NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
}

// Mobi turbo não existe. Nenhuma versão do Mobi teve sobrealimentação.
{
  const p = parseFipeVersion({
    brand: "Fiat",
    model: "MOBI EASY on 1.0 Fire Flex 5p.",
    year: "2021 Gasolina",
  });
  check("mobi NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("mobi: cilindrada", val(p.displacement), 1.0);
  check("mobi: portas", val(p.body.doors), 5);
}

// Kwid turbo não existe, e Kwid diesel muito menos (foi exatamente o tipo de
// erro que derrubou a antiga tabela de consumo).
{
  const p = parseFipeVersion({
    brand: "Renault",
    model: "KWID Intense 1.0 Flex 12V 5p Mec.",
    year: "2023 Flex",
  });
  check("kwid NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("kwid NÃO é diesel", val(p.fuel), FUEL.FLEX);
  check("kwid: cilindros não inventados", val(p.cylinders), null);
}

// GDI puro é injeção direta, não turbo. Niro 1.6 GDI é aspirado.
{
  const p = parseFipeVersion({
    brand: "Kia Motors",
    model: "Niro SX Prestige 1.6 GDI (Híbrido)",
    year: "2023 Híbrido",
  });
  check("niro GDI NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("niro: combustível híbrido", val(p.fuel), FUEL.HYBRID);
}

// O inverso: TSI sem TB é turbo. Chamar isso de aspirado serviria 84 cv para
// um carro de 128 cv — 52% de erro, com cara de certeza.
{
  const p = parseFipeVersion({
    brand: "VW - VolksWagen",
    model: "Polo Comfortline TSI 1.0 Flex 12V Aut.",
    year: "2020 Gasolina",
  });
  check("polo TSI É turbo", val(p.aspiration), ASPIRATION.TURBO);
  check("polo TSI: confiança explícita", conf(p.aspiration), CONFIDENCE.EXPLICIT);
}
{
  const p = parseFipeVersion({
    brand: "VW - VolksWagen",
    model: "Nivus Comfortline 1.0 200 TSI Flex Aut.",
    year: "2023 Gasolina",
  });
  check("nivus 200 TSI É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
{
  const p = parseFipeVersion({
    brand: "Fiat",
    model: "PULSE TRIBUTO 125 1.0 TB. 200 Flex Aut.",
    year: "2024 Gasolina",
  });
  check("pulse TB. É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
{
  const p = parseFipeVersion({
    brand: "Fiat",
    model: "Fastback Tributo 125 1.0 Turb. Flex Aut ",
    year: "2024 Gasolina",
  });
  check("fastback Turb. É turbo", val(p.aspiration), ASPIRATION.TURBO);
}

// RAM 5.7 Hemi turbo não existe. `R/T 5.7` casava com a regra Volvo `T-5`
// quando ela não tinha trava de marca. Sigla igual, fabricante diferente.
{
  const p = parseFipeVersion({
    brand: "RAM",
    model: "CLASSIC R/T 5.7 CD V8 4X4 Aut.",
    year: "2023 Gasolina",
  });
  check("ram hemi NÃO é turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("ram: V8", val(p.cylinders), 8);
}
// A mesma regra `T-5` na Volvo, onde ela É válida.
{
  const p = parseFipeVersion({
    brand: "Volvo",
    model: "XC 40 T-5 MOMENTUM 2.0 252cv AWD",
    year: "2020 Gasolina",
  });
  check("volvo T-5 É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
// Evoque Si4 é turbo; sem a família Ingenium na lista ele saía aspirado.
{
  const p = parseFipeVersion({
    brand: "Land Rover",
    model: "Range R.EVOQUE Si4 SE Dynamic 2.0 Aut.",
    year: "2019 Gasolina",
  });
  check("evoque Si4 É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
// Uma F-1000 com motor 1.0 não existe: o `1000` é o nome, não a cilindrada.
{
  const p = parseFipeVersion({
    brand: "Ford",
    model: "F-1000 XL 4.3 Turbo Diesel",
    year: "1998 Diesel",
  });
  check("f-1000 não vira 1.0", val(p.displacement), 4.3);
}
// Mas `Gol 1000` é cilindrada em cm³ de verdade.
{
  const p = parseFipeVersion({
    brand: "VW - VolksWagen",
    model: "Gol 1000 Mi 16V 2p Turbo",
    year: "1997 Gasolina",
  });
  check("gol 1000 é 1.0", val(p.displacement), 1.0);
  check("gol 1000: confiança derivada", conf(p.displacement), CONFIDENCE.DERIVED);
  check("gol 1000 turbo É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
// Fiat escreve o código do motor com o T DEPOIS: `1.0 200 T. Flex`. É turbo, e
// não pode ser confundido com o `T. Flex` do Gol, que é Total Flex.
{
  const p = parseFipeVersion({
    brand: "Fiat",
    model: "Fastback Audace 1.0 200 T. Flex Aut",
    year: "2024 Gasolina",
  });
  check("fastback 200 T. É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
// Sem cilindrada escrita, o código T200 dá a cilindrada — como inferência.
{
  const p = parseFipeVersion({
    brand: "Fiat",
    model: "Fastback Impetus 200 T. Aut (Hibrído)",
    year: "2025 Híbrido",
  });
  check("fastback híbrido: cilindrada por código", val(p.displacement), 1.0);
  check("fastback híbrido: marcada como inferida", conf(p.displacement), CONFIDENCE.INFERRED);
}
// Território 1.5 EcoBoost com o nome truncado pela FIPE.
{
  const p = parseFipeVersion({
    brand: "Ford",
    model: "TERRITORY Titanium 1.5 GTDi EcoBo. Aut.",
    year: "2023 Gasolina",
  });
  check("territory GTDi É turbo", val(p.aspiration), ASPIRATION.TURBO);
}
// Erro de digitação da própria FIPE: 1.6 de 12 válvulas implica 3 cilindros de
// 533 cm³, que ninguém vendeu no Brasil. Melhor não ter válvulas do que ter as
// erradas.
{
  const p = parseFipeVersion({
    brand: "Hyundai",
    model: "Creta N Line 1.6 TB 12V Flex Aut.",
    year: "2024 Gasolina",
  });
  check("creta 1.6 12V: válvulas implausíveis -> nulo", p.valves, null);
  check("creta 1.6: turbo mantido", val(p.aspiration), ASPIRATION.TURBO);
}
// Mas 1.5 de 12 válvulas é o três-cilindros do EcoBoost, e é real.
{
  const p = parseFipeVersion({
    brand: "Ford",
    model: "Focus Titanium 1.5 12V EcoBoost Aut.",
    year: "2018 Gasolina",
  });
  check("focus 1.5 12V é plausível", val(p.valves), 12);
}

// Argo 1.0 Firefly é 3 cilindros SOHC 6 VÁLVULAS. Um filtro de válvulas que só
// aceite 8/16 apaga um motor que existe e é comum.
{
  const p = parseFipeVersion({ brand: "Fiat", model: "ARGO 1.0 6V Flex", year: "2023 Gasolina" });
  check("argo: 6 válvulas é válido", val(p.valves), 6);
}

// Diesel de passeio pós-2005 é turbo por arquitetura — mas isso é inferência
// nossa e precisa sair marcada como tal.
{
  const p = parseFipeVersion({
    brand: "Toyota",
    model: "Hilux CD SRX 4x4 2.8 Diesel Aut.",
    year: "2022 Diesel",
  });
  check("hilux: diesel turbo inferido", val(p.aspiration), ASPIRATION.TURBO);
  check("hilux: inferência marcada", conf(p.aspiration), CONFIDENCE.INFERRED);
  check("hilux: tração", val(p.drivetrain), "awd");
  check("hilux: cabine dupla", val(p.body.cab), "double");
}
// Hilux 3.0 de 90 cv É diesel aspirado. Sem ano, não afirmamos nada.
{
  const p = parseFipeVersion({
    brand: "Toyota",
    model: "Hilux CS DX 4x2 3.0 8V 90cv Diesel",
    year: "1998 Diesel",
  });
  check("hilux 1998: não infere turbo", val(p.aspiration), ASPIRATION.NATURAL);
  check("hilux 1998: potência declarada", val(p.declaredPowerCv), 90);
}

// ---------------------------------------------------------------------------
// Ausência é ausência, nunca default
// ---------------------------------------------------------------------------

console.log("-- ausência --");

{
  const p = parseFipeVersion({ brand: "Fiat", model: "Uno Mille EP 2p e 4p", year: "1996 Gasolina" });
  check("uno mille: sem cilindrada", p.displacement, null);
  check("uno mille: portas ambíguas ficam nulas", val(p.body.doors), null);
  check("uno mille: ambiguidade de portas", p.ambiguities.includes(AMBIGUITY.MULTIPLE_DOORS), true);
  check("uno mille: sem câmbio", p.transmission, null);
  check("uno mille: sem chave de motor", p.engineKey, null);
}
{
  const p = parseFipeVersion({
    brand: "GM - Chevrolet",
    model: "Opala L/SL/SS/ 2.5/4.1",
    year: "1988 Gasolina",
  });
  check("opala: duas cilindradas -> nulo", p.displacement, null);
  check(
    "opala: ambiguidade registrada",
    p.ambiguities.includes(AMBIGUITY.MULTIPLE_DISPLACEMENTS),
    true,
  );
}
{
  const p = parseFipeVersion({
    brand: "Mitsubishi",
    model: "Airtrek 2.4 16V 163cv/ 136cv 4x4 5p Aut.",
    year: "2005 Gasolina",
  });
  // Par com barra não é par flex: aqui o primeiro é o maior. Escolher um dos
  // dois seria acertar metade das vezes.
  check("airtrek: potência ambígua -> nula", p.declaredPowerCv, null);
  check("airtrek: ambiguidade", p.ambiguities.includes(AMBIGUITY.MULTIPLE_POWERS), true);
}
{
  const p = parseFipeVersion({
    brand: "BYD",
    model: "Dolphin EV GS (Elétrico)",
    year: "2024 Elétrico",
  });
  check("dolphin: elétrico", val(p.fuel), FUEL.ELECTRIC);
  check("dolphin: sem cilindrada inventada", p.displacement, null);
  check("dolphin: sem aspiração", p.aspiration, null);
  check("dolphin: sem chave de motor", p.engineKey, null);
}
{
  const p = parseFipeVersion({ brand: "", model: "", year: "" });
  check("vazio não quebra", p.engineKey, null);
}

console.log(failures === 0 ? "\ntodas as assertivas passaram\n" : `\n${failures} assertiva(s) falharam\n`);

// ---------------------------------------------------------------------------
// 2. Cobertura medida
// ---------------------------------------------------------------------------

const samplePath = process.argv[2] || path.join(__dirname, ".cache", "fipe-models.json");
if (!fs.existsSync(samplePath)) {
  console.log(`sem amostra em ${samplePath} — rode 'node scripts/fetch-fipe-sample.mjs' para medir cobertura.`);
  process.exit(failures ? 1 : 0);
}

const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));

// A base FIPE inteira vai de 1985 a 2026. A frota que o Engine cadastra é
// contemporânea, então medimos os dois recortes: o total (honesto) e o
// subconjunto moderno (relevante). Proxy de "moderno": tem marcador flex,
// híbrido ou elétrico — nada disso existia antes de 2003.
const isModern = (row) =>
  /\b(FLEX|TSI|TB\b|TURBO|H[IÍ]BRID|EL[ÉE]TRIC|BI[-\s]?COMB|F\.\s?POWER|TOT)/i.test(row.model);

const FIELDS = [
  ["displacement", (p) => p.displacement],
  ["valves", (p) => p.valves],
  ["aspiration", (p) => p.aspiration],
  ["fuel", (p) => p.fuel],
  ["transmission", (p) => p.transmission],
  ["doors", (p) => p.body.doors],
  ["cab/style", (p) => p.body.cab || p.body.style],
  ["nameplate", (p) => p.nameplate],
  ["trim", (p) => p.trim],
  ["declaredPowerCv", (p) => p.declaredPowerCv],
  ["engineKey", (p) => p.engineKey],
];

function report(rows, label) {
  const parsed = rows.map((r) =>
    parseFipeVersion({ brand: r.brand, model: r.model, year: r.year || "" }),
  );
  const n = parsed.length;
  console.log(`\n== cobertura: ${label} (n=${n}) ==`);
  console.log("campo             extraído   explícito");
  for (const [name, get] of FIELDS) {
    const got = parsed.filter((p) => get(p));
    const explicit = got.filter((p) => get(p).confidence === CONFIDENCE.EXPLICIT);
    const pct = (x) => `${((x / n) * 100).toFixed(1)}%`.padStart(8);
    console.log(
      `${name.padEnd(18)}${pct(got.length)}   ${name === "engineKey" ? "" : pct(explicit.length)}`,
    );
  }

  // Linha separada para aspiração, porque é a que casa com a tabela de motor.
  const withAsp = parsed.filter((p) => p.aspiration);
  const explicitAsp = withAsp.filter((p) => p.aspiration.confidence === CONFIDENCE.EXPLICIT);
  const inferredAsp = withAsp.filter((p) => p.aspiration.confidence === CONFIDENCE.INFERRED);
  const confidentKey = parsed.filter((p) => p.engineKey?.confident);
  console.log(`\n  aspiração explícita (marcador lido): ${explicitAsp.length} (${((explicitAsp.length / n) * 100).toFixed(1)}%)`);
  console.log(`  aspiração INFERIDA (sem marcador):   ${inferredAsp.length} (${((inferredAsp.length / n) * 100).toFixed(1)}%)`);
  console.log(`  chave de motor com aspiração segura: ${confidentKey.length} (${((confidentKey.length / n) * 100).toFixed(1)}%)`);
  return parsed;
}

const withYear = sample.map((r) => ({ ...r, year: r.year || "2022 Gasolina" }));
report(withYear, "base FIPE completa");
const modern = withYear.filter(isModern);
report(modern, "frota contemporânea (flex/turbo/híbrido/elétrico)");

// ---------------------------------------------------------------------------
// Ambiguidade de aspiração medida pelos PRÓPRIOS dados
// ---------------------------------------------------------------------------
//
// Não precisa de lista feita à mão: se (marca + nome + cilindrada) aparece na
// FIPE COM marcador de turbo em alguma versão e SEM marcador em outra, então
// "sem marcador" não prova aspirado naquele conjunto. É a medição direta do
// risco de servir o número do motor errado.

const groups = new Map();
for (const row of withYear) {
  const p = parseFipeVersion(row);
  const key = versionGroupKey(p);
  if (!key) continue;
  const bucket = groups.get(key) || { blown: 0, guessedNa: 0, abstained: 0, sample: "" };
  if (p.aspiration && p.aspiration.value !== ASPIRATION.NATURAL) bucket.blown += 1;
  else if (p.aspiration?.confidence === CONFIDENCE.INFERRED) {
    bucket.guessedNa += 1;
    bucket.sample = bucket.sample || row.model;
  } else if (p.ambiguities.includes(AMBIGUITY.AMBIGUOUS_ASPIRATION_GROUP)) {
    bucket.abstained += 1;
  }
  groups.set(key, bucket);
}

const residual = [...groups.entries()].filter(
  ([, b]) => b.blown > 0 && b.guessedNa > 0,
);
const guessedTotal = [...groups.values()].reduce((sum, b) => sum + b.guessedNa, 0);
const abstainedTotal = [...groups.values()].reduce((sum, b) => sum + b.abstained, 0);
const residualRows = residual.reduce((sum, [, b]) => sum + b.guessedNa, 0);

console.log(`\n== aspiração: risco residual depois da abstenção ==`);
console.log(`grupos marca|modelo|cilindrada|combustível: ${groups.size}`);
console.log(`versões em que o parser se ABSTEVE: ${abstainedTotal}`);
console.log(`versões com aspirado ainda inferido: ${guessedTotal}`);
console.log(
  `dessas, em grupo que também tem sobrealimentado: ${residualRows} (${((residualRows / Math.max(guessedTotal, 1)) * 100).toFixed(1)}%)`,
);
if (residual.length) {
  console.log(
    "\nGRUPOS DE RISCO NÃO COBERTOS — copie para AMBIGUOUS_ASPIRATION_GROUPS em src/services/fipeVersion.js:",
  );
  residual
    .sort()
    .forEach(([key, b]) =>
      console.log(`  "${key}", // ${b.blown} sobrealim. vs ${b.guessedNa} sem marcador — ex: ${b.sample}`),
    );
} else {
  console.log("\nnenhum grupo de risco fora da lista de abstenção.");
}

// ---------------------------------------------------------------------------
// Amostra de falhas, para ler com olho de quem entende de carro
// ---------------------------------------------------------------------------

const noDisplacement = modern
  .map((r) => ({ r, p: parseFipeVersion(r) }))
  .filter(({ p }) => !p.displacement);
console.log(`\n== sem cilindrada na frota contemporânea: ${noDisplacement.length} ==`);
noDisplacement.slice(0, 15).forEach(({ r }) => console.log(`  ${r.brand} | ${r.model}`));

const noTrim = modern
  .map((r) => ({ r, p: parseFipeVersion(r) }))
  .filter(({ p }) => !p.nameplate);
console.log(`\n== nome comercial não reconhecido: ${noTrim.length} ==`);
noTrim.slice(0, 15).forEach(({ r }) => console.log(`  ${r.brand} | ${r.model}`));

process.exit(failures ? 1 : 0);
