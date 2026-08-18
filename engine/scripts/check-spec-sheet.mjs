#!/usr/bin/env node

/**
 * Verificação da ficha técnica editável e da camada de fábrica.
 *
 * Mesmo formato do `check-fipe-parser.mjs`, pelo mesmo motivo: ler o próprio
 * código e achar que está bom não é medição.
 *
 * 1. ASSERTIVAS — inclusive de CARRO IMPOSSÍVEL. Um Mobi de 400 cv tem de sair
 *    com aviso; um Kwid a diesel declarado tem de sair com aviso; um número
 *    fisicamente impossível não pode chegar ao banco. Isso é teste, não
 *    comentário.
 * 2. COBERTURA MEDIDA — roda a camada de fábrica contra as 4.864 versões reais
 *    da FIPE baixadas por `fetch-fipe-sample.mjs` e diz, com número, em quantos
 *    carros a ficha tem potência, em quantos ela fica RETIDA, em quantos ela
 *    fica AUSENTE e por quê. É esse número que decide se o estado vazio é o
 *    caso raro ou o caso comum. (Spoiler: é o comum.)
 *
 * Uso:
 *   node scripts/check-spec-sheet.mjs [amostra.json]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseFipeVersion } from "../src/services/fipeVersion.js";
import {
  ABSENT_REASON,
  HOLD_REASON,
  MATCH_SCOPE,
  SPEC_STATUS,
  getFactorySpecs,
} from "../src/services/vehicleSpecs.js";
import {
  SPEC_ISSUE,
  SPEC_LAYER,
  SPEC_METHOD,
  normalizeSpecSheet,
  publicSpecSheet,
  resolveVehicleSpecSheet,
  specModificationSignals,
  validateRawEntry,
} from "../src/services/carSpecSheet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(
      `FALHOU  ${label}\n        esperado ${JSON.stringify(expected)}\n        obtido   ${JSON.stringify(actual)}`,
    );
  }
  return ok;
};

const codes = (issues) => issues.map((issue) => issue.code).sort();
const has = (issues, code) => issues.some((issue) => issue.code === code);

const owned = (brand, model, year, specs) => ({
  id: "x",
  type: "owned",
  brand,
  model,
  year,
  specs,
});

const declared = (value, extra = {}) => ({
  value,
  origin: SPEC_LAYER.DECLARED,
  method: SPEC_METHOD.OWNER,
  ...extra,
});
const modified = (value, extra = {}) => ({
  value,
  origin: SPEC_LAYER.MODIFIED,
  method: SPEC_METHOD.OWNER,
  ...extra,
});

console.log("== assertivas ==\n");

// ---------------------------------------------------------------------------
// Camada 1 — fábrica
// ---------------------------------------------------------------------------
{
  const factory = getFactorySpecs({
    brand: "VW - VolksWagen",
    model: "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.",
    year: "2020 Gasolina",
  });
  check("polo 200 TSI: par flex de potência", factory.fields.powerCv.pair, {
    gasoline: 116,
    ethanol: 128,
  });
  check("polo 200 TSI: escopo verificado no modelo", factory.fields.powerCv.scope, MATCH_SCOPE.MODEL_VERIFIED);
  check("polo 200 TSI: torque idêntico colapsa em valor único", factory.fields.torque.pair, null);
  check("polo 200 TSI: torque 20,4", factory.fields.torque.value, 20.4);
  check("polo 200 TSI: 0-100 do veículo", factory.fields.accel0to100S.pair, {
    gasoline: 10.1,
    ethanol: 9.6,
  });
}
{
  // O override por modelo: a Saveiro tem 120 cv no etanol onde a chave crua daria
  // 117. Três cavalos que o olho não vê e que estariam errados do mesmo jeito.
  const saveiro = getFactorySpecs({
    brand: "VW - VolksWagen",
    model: "Saveiro CD Cross 1.6 MSI Total Flex 16V",
    year: "2019 Gasolina",
  });
  check("saveiro 1.6: override aplicado", saveiro.fields.powerCv.pair, {
    gasoline: 110,
    ethanol: 120,
  });
  const polo = getFactorySpecs({
    brand: "VW - VolksWagen",
    model: "Polo Comfortline 1.6 MSI Flex 16V 5p Aut.",
    year: "2019 Gasolina",
  });
  check("polo 1.6: sem override, 117 no etanol", polo.fields.powerCv.pair, {
    gasoline: 110,
    ethanol: 117,
  });
}
{
  // Abstenção herdada do parser: o Onix 1.0 aparece na FIPE com e sem turbo.
  const onix = getFactorySpecs({
    brand: "GM - Chevrolet",
    model: "ONIX HATCH LT 1.0 12V Flex 5p Mec.",
    year: "2022 Gasolina",
  });
  check("onix 1.0: potência RETIDA, não ausente", onix.fields.powerCv.status, SPEC_STATUS.HELD);
  check("onix 1.0: motivo é a aspiração", onix.fields.powerCv.reason, HOLD_REASON.ASPIRATION_UNKNOWN);
}
{
  // Janela de ano: a Hyundai só publica a ficha do MY corrente, então o HB20
  // usado — que é a maior parte da frota — fica fora. A resposta honesta é
  // "temos, mas de outro ano", e não "não temos".
  const velho = getFactorySpecs({
    brand: "Hyundai",
    model: "HB20 Comfort 1.0 TGDI Flex 12V Aut.",
    year: "2021 Gasolina",
  });
  check("hb20 2021: fora da janela do documento", velho.fields.powerCv.reason, ABSENT_REASON.OUTSIDE_YEAR_WINDOW);
  const novo = getFactorySpecs({
    brand: "Hyundai",
    model: "HB20 Platinum Plus 1.0 TGDI Flex 12V Aut.",
    year: "2026 Gasolina",
  });
  check("hb20 2026: dentro da janela", novo.fields.powerCv.pair, { gasoline: 115, ethanol: 120 });
}
{
  // Elétrico e híbrido não são endereçáveis pela chave de cilindrada, e dizer
  // isso é melhor do que casar por aproximação.
  const bev = getFactorySpecs({ brand: "BYD", model: "Dolphin EV GS (Elétrico)", year: "2024 Elétrico" });
  check("BEV: fora do escopo da tabela", bev.fields.powerCv.reason, ABSENT_REASON.OUT_OF_TABLE_SCOPE);
  check("BEV: status ausente, não retido", bev.fields.powerCv.status, SPEC_STATUS.ABSENT);
}

// ---------------------------------------------------------------------------
// Correção de identidade que DESTRAVA a ficha
// ---------------------------------------------------------------------------
{
  const car = owned("Hyundai", "HB20 Comfort 1.0 Flex 12V 5p Mec.", "2026 Gasolina");
  const antes = resolveVehicleSpecSheet(car);
  check("hb20 aspirado: retido antes da correção", antes.fields.powerCv.status, SPEC_STATUS.HELD);

  const depois = resolveVehicleSpecSheet({
    ...car,
    specs: { version: { aspiration: "naturally_aspirated" } },
  });
  check("hb20 aspirado: destravou com a correção", depois.fields.powerCv.pair, {
    gasoline: 75,
    ethanol: 80,
  });
  check("hb20 aspirado: a tela sabe que destravou", depois.unlockedBy.includes("powerCv"), true);
  check("hb20 aspirado: potência segue sendo de fábrica", depois.tags.powerCv, "fabrica");
  check("hb20 aspirado: a aspiração é dela", depois.tags.aspiration, "declarado");
}

// ---------------------------------------------------------------------------
// Camada 3 — o delta, que é a feature
// ---------------------------------------------------------------------------
{
  const car = owned("VW - VolksWagen", "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.", "2020 Gasolina", {
    performance: { powerCv: modified(200) },
    mods: ["remap", "exhaust", "intercooler"],
    stage: "stage2",
    notes: "Stage 2 na oficina do bairro, escape 3 polegadas.",
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("polo stage 2: valor de hoje", sheet.fields.powerCv.value, 200);
  check("polo stage 2: rótulo", sheet.tags.powerCv, "modificado");
  check("polo stage 2: guarda o de fábrica que substituiu", sheet.fields.powerCv.replaces.pair, {
    gasoline: 116,
    ethanol: 128,
  });
  check("polo stage 2: entra na lista de deltas", sheet.deltas.length, 1);
  check("polo stage 2: sem aviso, o salto fecha com o que foi feito", codes(sheet.issues), []);
  check("polo stage 2: tem modificação", sheet.hasModifications, true);
}
{
  // Camada 2 pura: o carro é de fábrica, o buraco é nosso. Complementa, não
  // substitui, e a tela não deve desenhar seta nenhuma.
  const car = owned("Fiat", "ARGO DRIVE 1.3 Firefly Flex 8V 5p Mec.", "2021 Gasolina", {
    performance: { topSpeedKmh: declared(178) },
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("argo: velocidade declarada", sheet.tags.topSpeedKmh, "declarado");
  check("argo: não substitui nada", sheet.fields.topSpeedKmh.replaces, null);
  check("argo: preenche um buraco conhecido", Boolean(sheet.fields.topSpeedKmh.fills), true);
  check("argo: não conta como modificação", sheet.hasModifications, false);
}
{
  // Camada 2 dando um número que a fábrica desmente: 90 cv num Polo 200 TSI de
  // 116/128. Quase sempre é o número de outra versão. Mostra o dela, guarda o de
  // fábrica, e NÃO conta como delta — delta é só camada 3.
  const car = owned("VW - VolksWagen", "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.", "2020 Gasolina", {
    performance: { powerCv: declared(90) },
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("conflito: mostra o número da pessoa", sheet.fields.powerCv.value, 90);
  check("conflito: não vira seta de delta", sheet.deltas.length, 0);
  check("conflito: entra na lista de conflitos", sheet.conflicts.length, 1);
  check("conflito: o de fábrica continua ao alcance", sheet.fields.powerCv.replaces.pair.ethanol, 128);
  check("conflito: avisado", has(sheet.issues, SPEC_ISSUE.DECLARED_CONFLICTS_WITH_FACTORY), true);
}
{
  // Correção que NÃO destrava nada não pode reivindicar crédito.
  const car = owned("VW - VolksWagen", "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.", "2020 Gasolina", {
    version: { doors: 5 },
  });
  check("corrigir portas não destrava potência", resolveVehicleSpecSheet(car).unlockedBy, []);
}
{
  // Dinamômetro: método, não camada. E "na roda" não é comparável com ficha de
  // fábrica, que é sempre no motor.
  const car = owned("VW - VolksWagen", "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.", "2020 Gasolina", {
    performance: {
      powerCv: modified(180, {
        method: SPEC_METHOD.DYNO,
        basis: "wheel",
        fuelBasis: "ethanol",
        shop: "Dino do Zé",
        date: "2026-03-10",
      }),
    },
    mods: ["remap"],
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("dino: rótulo medido", sheet.tags.powerCv, "medido");
  check("dino: camada continua modificado", sheet.fields.powerCv.origin, SPEC_LAYER.MODIFIED);
  check("dino: procedência guardada", sheet.fields.powerCv.source.doc, "Dino do Zé");
  check("dino: roda x motor sinalizado", has(sheet.issues, SPEC_ISSUE.WHEEL_BASIS_NOT_COMPARABLE), true);
}

// ---------------------------------------------------------------------------
// Carro impossível — a parte que só eu pego
// ---------------------------------------------------------------------------
{
  // 400 cv num Mobi 1.0 de fábrica com 74. Não trava (existe Mobi de arrancada),
  // mas sai com três avisos, e um deles é o que importa: nada no motor foi
  // marcado.
  const car = owned("Fiat", "MOBI LIKE 1.0 Fire Flex 8V 5p", "2022 Gasolina", {
    performance: { powerCv: modified(400) },
    mods: ["wheels", "sound"],
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("mobi 400 cv: grava mesmo assim", sheet.fields.powerCv.value, 400);
  check(
    "mobi 400 cv: avisos",
    codes(sheet.issues),
    [
      SPEC_ISSUE.POWER_ABOVE_FACTORY_WITHOUT_ENGINE_MOD,
      SPEC_ISSUE.POWER_FAR_ABOVE_FACTORY,
      SPEC_ISSUE.SPECIFIC_OUTPUT_IMPLAUSIBLE,
    ].sort(),
  );
}
{
  // O mesmo 400 cv num 2.0 turbo com preparação marcada: 200 cv/L é sábado no
  // preparador, e a tela não tem nada a dizer.
  const car = owned("VW - VolksWagen", "JETTA GLI 2.0 TSI 16V 4p Aut.", "2015 Gasolina", {
    performance: { powerCv: modified(400) },
    mods: ["turbo", "remap", "injection", "intercooler"],
    stage: "stage3",
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("jetta 400 cv preparado: sem aviso", codes(sheet.issues), []);
  // A tabela do Han não tem VW 2.0 TSI: o de fábrica é desconhecido e a tela
  // NÃO pode desenhar a seta. É o caso mais comum da base inteira.
  check("jetta: sem valor de fábrica para comparar", sheet.fields.powerCv.replaces, null);
}
{
  // Kwid a diesel: o carro que nunca existiu. A FIPE escreveu Flex com todas as
  // letras, então isto não é preencher buraco, é contradizer o documento.
  const car = owned("Renault", "KWID ZEN 1.0 Flex 12V 5p Mec.", "2023 Gasolina", {
    version: { fuel: "diesel" },
  });
  const sheet = resolveVehicleSpecSheet(car);
  check(
    "kwid diesel: contradiz a FIPE",
    has(sheet.issues, SPEC_ISSUE.VERSION_CORRECTION_CONTRADICTS_FIPE),
    true,
  );
}
{
  // Unidade trocada: 30 kgfm digitado como 30 Nm em cima de 220 cv.
  const car = owned("VW - VolksWagen", "JETTA GLI 2.0 TSI 16V 4p Aut.", "2015 Gasolina", {
    performance: { powerCv: modified(220), torque: modified(30, { unit: "Nm" }) },
    mods: ["remap"],
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("torque 30 Nm com 220 cv: unidade suspeita", has(sheet.issues, SPEC_ISSUE.TORQUE_UNIT_SUSPECT), true);
  check(
    "torque: sugere a unidade certa",
    sheet.issues.find((issue) => issue.code === SPEC_ISSUE.TORQUE_UNIT_SUSPECT).data.suggestedUnit,
    "kgfm",
  );
}
{
  // GNV não dá potência, tira.
  const car = owned("VW - VolksWagen", "Polo Comfortline 200 TSI 1.0 Flex 12V 5p Aut.", "2020 Gasolina", {
    performance: { powerCv: modified(140) },
    mods: ["gnv"],
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("gnv com ganho: avisa", has(sheet.issues, SPEC_ISSUE.GNV_WITH_POWER_GAIN), true);
}
{
  // 300 km/h com 100 cv, e 0-100 em 3 s com 120 cv.
  const car = owned("Fiat", "MOBI LIKE 1.0 Fire Flex 8V 5p", "2022 Gasolina", {
    performance: { topSpeedKmh: declared(300), accel0to100S: declared(3) },
  });
  const sheet = resolveVehicleSpecSheet(car);
  check("300 km/h com 74 cv", has(sheet.issues, SPEC_ISSUE.TOP_SPEED_IMPLAUSIBLE_FOR_POWER), true);
  check("0-100 em 3 s com 74 cv", has(sheet.issues, SPEC_ISSUE.ACCEL_IMPLAUSIBLE_FOR_POWER), true);
}

// ---------------------------------------------------------------------------
// Normalização e limites
// ---------------------------------------------------------------------------
{
  check(
    "5.000 cv não chega ao banco",
    normalizeSpecSheet({ performance: { powerCv: modified(5000) } }),
    null,
  );
  check(
    "e a tela sabe explicar por quê",
    validateRawEntry("powerCv", { value: 5000 })[0].code,
    SPEC_ISSUE.OUT_OF_PHYSICAL_RANGE,
  );
  check("ficha vazia é null, não objeto vazio", normalizeSpecSheet({ mods: [], notes: "  " }), null);
  check(
    "chip inventado é descartado",
    normalizeSpecSheet({ mods: ["turbo", "asa-delta"] }).mods,
    ["turbo"],
  );
  check(
    "texto livre tem teto",
    normalizeSpecSheet({ notes: "a".repeat(5000) }).notes.length,
    1200,
  );
  const sujo = normalizeSpecSheet({ notes: `linha 1${String.fromCharCode(0)}linha 2` });
  check("controle vira espaço", sujo.notes, "linha 1 linha 2");
}

// ---------------------------------------------------------------------------
// Comunidade e fronteira com a Xuria
// ---------------------------------------------------------------------------
{
  const specs = {
    performance: { powerCv: modified(200) },
    mods: ["remap"],
    notes: "stage 2",
  };
  check(
    "carro-meta não publica ficha de exemplar",
    publicSpecSheet({ type: "goal", specs }),
    null,
  );
  const pub = publicSpecSheet({ type: "owned", specs });
  check("carro possuído publica", pub.performance.powerCv.value, 200);
  check("e sempre com a camada junto", pub.performance.powerCv.origin, SPEC_LAYER.MODIFIED);
  check("e com o método junto", pub.performance.powerCv.method, SPEC_METHOD.OWNER);
  check("payload inteiro marcado como do dono", pub.declaredByOwner, true);
  check("nada de fábrica vai junto", Object.keys(pub).includes("factory"), false);
}
{
  const signals = specModificationSignals(
    owned("Fiat", "MOBI LIKE 1.0 Fire Flex 8V 5p", "2022 Gasolina", {
      mods: ["gnv"],
    }),
  );
  check("GNV invalida a estimativa de consumo", signals.recommend.includes("invalidateConsumptionEstimate"), true);
  check("GNV sozinho não é preparação de motor", signals.hasEngineModifications, false);

  const blindado = specModificationSignals(
    owned("Fiat", "TORO Volcano 1.3 T270 16V Flex Aut.", "2023 Gasolina", { mods: ["armor"] }),
  );
  check("blindagem entra como ressalva de seguro", blindado.recommend.includes("insuranceCaveat"), true);
  check("blindagem entra como peso", blindado.recommend.includes("weightPenalty"), true);

  const limpo = specModificationSignals(owned("Fiat", "ARGO 1.3 Flex 8V", "2021 Gasolina", null));
  check("carro sem ficha não sinaliza nada", limpo.recommend, []);
}

// ---------------------------------------------------------------------------
// Tamanho no documento
// ---------------------------------------------------------------------------
{
  const cheio = normalizeSpecSheet({
    version: { aspiration: "turbo", transmission: "manual", fuel: "flex", drivetrain: "awd", doors: 4, valves: 16 },
    performance: {
      powerCv: modified(400, { method: SPEC_METHOD.DYNO, basis: "wheel", fuelBasis: "ethanol", shop: "A".repeat(60), date: "2026-08-17", note: "N".repeat(140) }),
      torque: modified(50, { unit: "kgfm", note: "N".repeat(140) }),
      topSpeedKmh: modified(280, { note: "N".repeat(140) }),
      accel0to100S: modified(4.8, { note: "N".repeat(140) }),
    },
    mods: ["turbo", "remap", "intake", "exhaust", "intercooler", "injection", "camshaft", "internals", "gnv", "clutch", "gearbox", "suspension", "brakes", "wheels", "bodykit", "sound", "armor"],
    stage: "stage3",
    notes: "N".repeat(1200),
  });
  const bytes = Buffer.byteLength(JSON.stringify(cheio), "utf8");
  console.log(`\nficha declarada no pior caso: ${bytes} bytes (orçamento do doc: 891.289)`);
  check("pior caso cabe folgado no documento", bytes < 4096, true);
}

console.log(failures === 0 ? "\ntodas as assertivas passaram\n" : `\n${failures} assertiva(s) falharam\n`);

// ---------------------------------------------------------------------------
// 2. Cobertura medida
// ---------------------------------------------------------------------------

const samplePath = process.argv[2] || path.join(__dirname, ".cache", "fipe-models.json");
if (!fs.existsSync(samplePath)) {
  console.log(`sem amostra em ${samplePath} — rode 'node scripts/fetch-fipe-sample.mjs'.`);
  process.exit(failures ? 1 : 0);
}

const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));

const measure = (label, year) => {
  const tally = { value: 0, held: 0, absent: 0 };
  const scopes = { [MATCH_SCOPE.MODEL_VERIFIED]: 0, [MATCH_SCOPE.ENGINE_FAMILY]: 0 };
  const reasons = {};
  const perf = { value: 0, held: 0, absent: 0 };
  let unlockable = 0;

  for (const row of sample) {
    const car = { brand: row.brand, model: row.model, year };
    const parsed = parseFipeVersion(car);
    const factory = getFactorySpecs(car, { parsed });
    const power = factory.fields.powerCv;

    tally[power.status] += 1;
    if (power.status === SPEC_STATUS.VALUE) scopes[power.scope] += 1;
    else reasons[power.reason] = (reasons[power.reason] || 0) + 1;

    perf[factory.fields.accel0to100S.status] += 1;

    // Quantos dos RETIDOS a própria pessoa consegue destravar dizendo qual é o
    // motor dela. É a métrica que justifica o campo editável de aspiração.
    if (power.reason === HOLD_REASON.ASPIRATION_UNKNOWN) {
      const destravou = ["turbo", "naturally_aspirated"].some((aspiration) => {
        const corrigido = getFactorySpecs(car, {
          parsed: { ...parsed, aspiration: { value: aspiration, confidence: "declared", evidence: "" } },
        });
        return corrigido.fields.powerCv.status === SPEC_STATUS.VALUE;
      });
      if (destravou) unlockable += 1;
    }
  }

  const pct = (n) => `${((n / sample.length) * 100).toFixed(1)}%`;
  console.log(`\n--- ${label} (${sample.length} versões) ---`);
  console.log(`potência de fábrica  valor ${pct(tally.value)}   retido ${pct(tally.held)}   ausente ${pct(tally.absent)}`);
  console.log(`  verificada no modelo ${scopes[MATCH_SCOPE.MODEL_VERIFIED]}, por família de motor ${scopes[MATCH_SCOPE.ENGINE_FAMILY]}`);
  console.log(`desempenho (0-100)   valor ${pct(perf.value)}   retido ${pct(perf.held)}   ausente ${pct(perf.absent)}`);
  console.log(`destraváveis pela correção do dono: ${unlockable} (${pct(unlockable)})`);
  console.log("motivos:");
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${pct(count).padStart(6)}  ${reason}`);
  }
};

/**
 * A medição acima é por VERSÃO da FIPE, e por versão a base é dominada por
 * carro antigo e por nicho: a FIPE lista 4.864 versões, das quais a esmagadora
 * maioria são Opalas, Corcéis e importados de dez unidades. A Garagem não é
 * assim — ela se concentra nos mesmos vinte carros que o Brasil compra.
 *
 * Então mede-se também a FROTA: versões reais, contemporâneas, dos modelos mais
 * vendidos. Esta é a taxa que a pessoa de verdade vai encontrar, e a de cima é
 * o piso. As duas juntas são a resposta honesta; qualquer uma sozinha mente.
 */
const FLEET = [
  ["GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.", "2022 Gasolina"],
  ["GM - Chevrolet", "ONIX HATCH LTZ 1.0 12V TB Flex 5p Aut.", "2022 Gasolina"],
  ["GM - Chevrolet", "TRACKER 1.0 Turbo 12V Flex Aut.", "2022 Gasolina"],
  ["Hyundai", "HB20 Comfort 1.0 Flex 12V 5p Mec.", "2023 Gasolina"],
  ["Hyundai", "HB20 Platinum Plus 1.0 TGDI Flex 12V Aut.", "2026 Gasolina"],
  ["Hyundai", "Creta Comfort 1.0 TGDI Flex 12V Aut.", "2023 Gasolina"],
  ["Fiat", "STRADA Freedom 1.3 Flex 8V CD", "2023 Gasolina"],
  ["Fiat", "ARGO DRIVE 1.0 6V Flex", "2022 Gasolina"],
  ["Fiat", "MOBI LIKE 1.0 Fire Flex 8V 5p", "2022 Gasolina"],
  ["Fiat", "PULSE Drive 1.0 Turbo 200 Flex Aut.", "2023 Gasolina"],
  ["Fiat", "Toro Volcano 1.3 T270 16V Flex Aut.", "2023 Gasolina"],
  ["Jeep", "COMPASS Longitude 1.3 T270 4x2 Flex Aut.", "2022 Gasolina"],
  ["Jeep", "Renegade Sport 1.3 T270 4x2 Flex Aut.", "2022 Gasolina"],
  ["VW - VolksWagen", "Polo Track 1.0 Flex 12V 5p Mec.", "2023 Gasolina"],
  ["VW - VolksWagen", "T-Cross 200 TSI 1.0 Flex 12V 5p Aut.", "2022 Gasolina"],
  ["VW - VolksWagen", "VIRTUS 1.6 MSI Flex 16V 4p Aut.", "2022 Gasolina"],
  ["VW - VolksWagen", "Nivus Comfortline 1.0 200 TSI Flex Aut.", "2022 Gasolina"],
  ["VW - VolksWagen", "Gol 1.0 Flex 12V 5p", "2020 Gasolina"],
  ["VW - VolksWagen", "Saveiro Robust 1.6 Total Flex 16V CS", "2022 Gasolina"],
  ["Renault", "KWID Zen 1.0 Flex 12V 5p Mec.", "2023 Gasolina"],
  ["Renault", "DUSTER Intense 1.6 16V Flex 5p Aut.", "2023 Gasolina"],
  ["Toyota", "Corolla XEi 2.0 16V Flex Aut.", "2022 Gasolina"],
  ["Toyota", "Hilux SRV 2.8 TDI 4x4 Diesel Aut.", "2022 Diesel"],
  ["Honda", "HR-V EXL 1.5 Flex TB 16V 5p Aut.", "2023 Gasolina"],
  ["Nissan", "KICKS Active 1.6 16V Flex Aut.", "2023 Gasolina"],
  ["Ford", "Ranger XLS 3.2 Diesel 4x4 CD Aut.", "2020 Diesel"],
];

const measureFleet = () => {
  console.log(`\n--- frota real (${FLEET.length} versões contemporâneas de modelos de volume) ---`);
  let withValue = 0;
  for (const [brand, model, year] of FLEET) {
    const factory = getFactorySpecs({ brand, model, year });
    const power = factory.fields.powerCv;
    const label =
      power.status === SPEC_STATUS.VALUE
        ? `${power.pair ? `${power.pair.ethanol}/${power.pair.gasoline}` : power.value} cv (${power.scope})`
        : `${power.status}: ${power.reason}`;
    if (power.status === SPEC_STATUS.VALUE) withValue += 1;
    console.log(`  ${model.slice(0, 42).padEnd(44)}${label}`);
  }
  console.log(
    `  => potência de fábrica em ${withValue}/${FLEET.length} (${((withValue / FLEET.length) * 100).toFixed(0)}%)`,
  );
};

// Sem ano, toda janela passa: é o teto otimista da cobertura.
measure("ano desconhecido (teto otimista)", "");
// Com um carro de 2023, as janelas de Hyundai e Renault (2025+) caem fora. É o
// recorte realista: a Garagem é feita de carro usado.
measure("ano-modelo 2023 (recorte realista)", "2023 Gasolina");
measureFleet();

process.exit(failures ? 1 : 0);
