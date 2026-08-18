/**
 * Ficha técnica editável — camadas 2 e 3, e a resolução das três.
 *
 * A tese, que atravessa o arquivo inteiro: existem TRÊS verdades diferentes
 * sobre um carro, e fundi-las é como se estraga uma ficha técnica.
 *
 *   1. FÁBRICA (`vehicleSpecs.js`)  — afirmação sobre a VERSÃO. Não é editável.
 *      Um Jetta GLI 2.0 TSI 2015 tem 211 cv de fábrica, hoje e sempre, mesmo
 *      que o exemplar da pessoa esteja com o motor fundido.
 *   2. DECLARADO — a pessoa preenche um buraco que a fábrica deixou. O carro
 *      continua de fábrica; nós é que não sabíamos. COMPLEMENTA.
 *   3. MODIFICADO — a pessoa diz que o exemplar não é mais de fábrica. Stage 2,
 *      turbo maior, remap. Aqui os 211 cv não estão faltando: estão ERRADOS
 *      para este carro. SUBSTITUI, e a tela mostra os dois:
 *      `de fábrica 211 cv → hoje 300 cv`.
 *
 * Esse delta é a feature. Nenhum catálogo do mundo tem, porque não é dado sobre
 * a versão — é dado sobre o exemplar, e só o dono tem.
 *
 * "MEDIDO" NÃO É UMA QUARTA CAMADA, e essa é a única divergência de fundo que
 * eu tenho com o desenho proposto. Folha de dinamômetro é MÉTODO, não camada:
 * um dinamômetro num carro de fábrica ainda é camada 2 (a pessoa mediu o que a
 * fábrica entregou), e num stage 2 é camada 3. Se "medido" virasse valor do
 * mesmo enum, um carro original com folha de dino e um stage 3 medido ficariam
 * indistinguíveis — e são a coisa mais diferente que existe para seguro, para
 * revenda e para a conversa da Comunidade. Então guardo dois eixos, `layer` e
 * `method`, e projeto os quatro rótulos que o Murilo pediu em `originTag`. A
 * tela recebe exatamente o vocabulário que ele pediu; o banco guarda a verdade
 * inteira.
 *
 * ONDE ISTO MORA. No próprio documento do carro, ao contrário da ficha de
 * fábrica. Não é incoerência: ficha de fábrica é compartilhada por todo mundo
 * que tem aquela versão (logo, coleção própria por versão), e ficha declarada é
 * de UM exemplar — não existe outro dono para reaproveitar. O custo está
 * medido por `scripts/check-spec-sheet.mjs`, e não estimado: o objeto inteiro
 * cheio — os quatro números com nota e procedência, todos os chips, o texto
 * livre no teto — dá 2.750 bytes contra os 891.289 do orçamento do documento, e
 * contra 200-700 KB de UMA foto em base64. É 0,3% do documento.
 */

import { parseFipeVersion, ASPIRATION, FUEL, TRANSMISSION } from "./fipeVersion.js";
import {
  ABSENT_REASON,
  MATCH_SCOPE,
  SPEC_STATUS,
  getFactorySpecs,
  toKgfm,
  toNm,
} from "./vehicleSpecs.js";

/** Camada da afirmação. Não confundir com `SPEC_METHOD`. */
export const SPEC_LAYER = {
  FACTORY: "factory",
  DECLARED: "declared",
  MODIFIED: "modified",
};

/** Como o número foi obtido. Ortogonal à camada. */
export const SPEC_METHOD = {
  /** Catálogo do fabricante — só a camada de fábrica usa. */
  CATALOG: "catalog",
  /** A pessoa informou: leu no manual, no anúncio, ou sabe de cor. */
  OWNER: "owner",
  /** Folha de dinamômetro. Continua sendo alegação nossa, mas de outra ordem. */
  DYNO: "dyno",
};

/**
 * Onde o número foi medido. Só faz sentido para potência e torque, e é a
 * distinção que mais separa quem entende de quem não entende: "400 cv na roda"
 * e "400 cv no motor" são ~15-20% de diferença, e a ficha de fábrica é SEMPRE
 * no motor (norma NBR ISO 1585). Comparar um com o outro sem dizer qual é qual
 * produz um delta falso — que é exatamente o erro que esta feature existe para
 * não cometer.
 */
export const POWER_BASIS = {
  CRANK: "crank",
  WHEEL: "wheel",
};

/** Rótulo único para a tela: os quatro que o Murilo pediu. */
export function originTag(cell) {
  if (!cell || cell.origin === SPEC_LAYER.FACTORY) return "fabrica";
  if (cell.method === SPEC_METHOD.DYNO) return "medido";
  if (cell.origin === SPEC_LAYER.MODIFIED) return "modificado";
  return "declarado";
}

// ---------------------------------------------------------------------------
// Campos numéricos abertos para edição
// ---------------------------------------------------------------------------

/**
 * Quatro números, e a razão de serem quatro.
 *
 * Estes são os que as pessoas realmente preenchem e os únicos que a Comunidade
 * consegue comparar depois. Ficaram DE FORA de propósito: peso, dimensões,
 * porta-malas e tanque (a pessoa não sabe de cabeça e não muda com preparação),
 * consumo (é da Xuria, e medido pelos abastecimentos reais em `expenses.js`,
 * que é dado melhor que qualquer declaração), e pressão de turbo (a unidade
 * varia entre bar e psi por oficina, e sem padronizar vira lixo comparável —
 * fica no texto livre nesta rodada).
 *
 * `hardMin`/`hardMax` são limites FÍSICOS, não de bom senso: fora deles o valor
 * é erro de digitação, e a normalização DESCARTA em vez de gravar. Tudo que é
 * julgamento sobre o carro vira aviso em `validateSpecSheet`, nunca trava.
 */
export const SPEC_FIELDS = [
  {
    id: "powerCv",
    unit: "cv",
    decimals: 0,
    hardMin: 15,
    hardMax: 2000,
    hasBasis: true,
    hasFuelBasis: true,
  },
  {
    id: "torque",
    // Duas unidades porque o Brasil usa as duas: fabricante nacional publica em
    // kgfm, importado e Stellantis publicam em Nm. Converter na entrada perde a
    // unidade em que a pessoa pensa; guardo a dela e converto na comparação.
    unit: null,
    units: ["kgfm", "Nm"],
    decimals: 1,
    hardMin: 1,
    hardMax: 250,
    hardMinNm: 10,
    hardMaxNm: 2500,
    hasBasis: true,
    hasFuelBasis: true,
  },
  { id: "topSpeedKmh", unit: "km/h", decimals: 0, hardMin: 40, hardMax: 500 },
  { id: "accel0to100S", unit: "s", decimals: 1, hardMin: 1.5, hardMax: 90 },
];

const SPEC_FIELD_BY_ID = new Map(SPEC_FIELDS.map((field) => [field.id, field]));

/**
 * Campos de IDENTIDADE que a pessoa pode corrigir.
 *
 * Estes não são enfeite: eles voltam para dentro da busca. Quando o parser se
 * abstém na aspiração — 317 versões, o caso do Onix 1.0 que a FIPE lista com e
 * sem turbo — a ficha inteira fica retida. Basta a pessoa dizer "o meu é
 * aspirado" para a chave de motor fechar e a potência aparecer. É o caminho que
 * torna alcançáveis os 80 cv do HB20 Kappa, que hoje existem na tabela do Han e
 * não chegam a nenhuma tela.
 *
 * Ou seja: a correção do usuário não corrige só o campo dela. Ela DESTRAVA os
 * outros. Não conheço nenhum catálogo brasileiro que faça isso.
 */
export const VERSION_FIELDS = [
  { id: "aspiration", values: Object.values(ASPIRATION) },
  { id: "transmission", values: Object.values(TRANSMISSION) },
  { id: "fuel", values: Object.values(FUEL) },
  { id: "drivetrain", values: ["fwd", "rwd", "awd"] },
  { id: "doors", min: 2, max: 5 },
  { id: "valves", values: [6, 8, 10, 12, 16, 20, 24, 32, 40, 48] },
];

const VERSION_FIELD_BY_ID = new Map(VERSION_FIELDS.map((field) => [field.id, field]));

// ---------------------------------------------------------------------------
// Chips de modificação
// ---------------------------------------------------------------------------

/**
 * Vocabulário FECHADO, e fechado de propósito: chip livre vira tag solta e
 * nunca mais é filtrável. O que não couber aqui vai no texto livre, que existe
 * justamente para isso.
 *
 * `engine: true` marca o que pode legitimar um número de potência acima do de
 * fábrica. Roda e som não podem — e é essa checagem que separa "stage 2 de
 * verdade" de número inventado, sem precisar duvidar de ninguém.
 *
 * Duas entradas que não aparecem em lista nenhuma de tuning e são as mais
 * brasileiras daqui — mais uma que ficou de fora de propósito:
 *   - `gnv`: a modificação mais comum da frota nacional. TIRA potência (~10-15%
 *     no ciclo Otto convertido), muda a estrutura de custo inteira e é a que
 *     mais mexe no que a Xuria calcula.
 *   - `armor`: blindagem soma 150-200 kg, come desempenho e consumo, e muda o
 *     seguro de patamar.
 *   - `lpgOrKit` ficou de fora: GLP em automóvel é irregular no Brasil e não
 *     vou abrir campo para registrar o que não pode circular.
 */
export const MOD_CHIPS = [
  { id: "turbo", group: "engine", engine: true },
  { id: "remap", group: "engine", engine: true },
  { id: "intake", group: "engine", engine: true },
  { id: "exhaust", group: "engine", engine: true },
  { id: "intercooler", group: "engine", engine: true },
  { id: "injection", group: "engine", engine: true },
  { id: "camshaft", group: "engine", engine: true },
  { id: "internals", group: "engine", engine: true },
  { id: "gnv", group: "engine", engine: false, reducesPower: true },
  { id: "clutch", group: "drivetrain", engine: false },
  { id: "gearbox", group: "drivetrain", engine: false },
  { id: "suspension", group: "chassis", engine: false },
  { id: "brakes", group: "chassis", engine: false },
  { id: "wheels", group: "chassis", engine: false },
  { id: "bodykit", group: "cosmetic", engine: false },
  { id: "sound", group: "cosmetic", engine: false },
  { id: "armor", group: "use", engine: false },
];

const MOD_CHIP_IDS = MOD_CHIPS.map((chip) => chip.id);
const ENGINE_CHIPS = new Set(MOD_CHIPS.filter((chip) => chip.engine).map((chip) => chip.id));

/**
 * "Stage" é rótulo de cultura, não unidade: cada preparador chama de stage 2
 * uma coisa. Guardo porque é como a pessoa descreve o próprio carro — e NUNCA
 * derivo número dele. Stage não vira cavalo em lugar nenhum deste arquivo.
 */
export const STAGES = ["stock", "stage1", "stage2", "stage3", "custom"];

// ---------------------------------------------------------------------------
// Limites de tamanho
// ---------------------------------------------------------------------------

export const SPEC_LIMITS = {
  /** A preparação contada como história. Cabe um parágrafo bom. */
  notes: 1200,
  /** Nota por campo: "no etanol, com 0,8 bar". */
  fieldNote: 140,
  /** Nome da oficina/preparador que fez a medição. */
  shop: 60,
  mods: MOD_CHIPS.length,
};

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

const clean = (value, max) =>
  String(value ?? "")
    // Controle e caractere de formatação viram espaco: colar de PDF ou de
    // WhatsApp traz separador de linha e largura zero, que so aparecem no bug.
    .replace(/\p{Cc}|\p{Cf}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Um número declarado. Fora da faixa física, DESCARTA — não corta para o teto.
 * Cortar 5.000 cv para 2.000 seria fabricar um número que ninguém digitou, que
 * é o defeito que esta feature inteira existe para não repetir.
 */
const normalizeEntry = (fieldDef, raw) => {
  if (!raw || typeof raw !== "object") return null;

  const value = Number(raw.value);
  if (!Number.isFinite(value)) return null;

  const unit = fieldDef.units
    ? fieldDef.units.includes(raw.unit)
      ? raw.unit
      : fieldDef.units[0]
    : fieldDef.unit;

  const min = unit === "Nm" && fieldDef.hardMinNm ? fieldDef.hardMinNm : fieldDef.hardMin;
  const max = unit === "Nm" && fieldDef.hardMaxNm ? fieldDef.hardMaxNm : fieldDef.hardMax;
  if (value < min || value > max) return null;

  const layer = raw.origin === SPEC_LAYER.MODIFIED ? SPEC_LAYER.MODIFIED : SPEC_LAYER.DECLARED;
  const method = raw.method === SPEC_METHOD.DYNO ? SPEC_METHOD.DYNO : SPEC_METHOD.OWNER;

  return {
    value: round(value, fieldDef.decimals),
    unit: unit || null,
    origin: layer,
    method,
    basis:
      fieldDef.hasBasis && (raw.basis === POWER_BASIS.WHEEL || raw.basis === POWER_BASIS.CRANK)
        ? raw.basis
        : null,
    fuelBasis:
      fieldDef.hasFuelBasis && ["ethanol", "gasoline", "diesel", "cng"].includes(raw.fuelBasis)
        ? raw.fuelBasis
        : null,
    // Procedência da medição. Guardo o nome da oficina e a data em vez da foto
    // da folha: ver `SPEC_STORAGE_NOTE`.
    shop: method === SPEC_METHOD.DYNO ? clean(raw.shop, SPEC_LIMITS.shop) : "",
    date: method === SPEC_METHOD.DYNO ? clean(raw.date, 10) : "",
    note: clean(raw.note, SPEC_LIMITS.fieldNote),
  };
};

/**
 * POR QUE A FOLHA DE DINAMÔMETRO NÃO É GUARDADA COMO IMAGEM AQUI.
 *
 * Três motivos, em ordem de peso:
 *
 * 1. O documento do carro já é o gargalo. Ele carrega até quatro fotos em
 *    base64 e até 300 lançamentos de gasto contra 1 MB de limite do Firestore,
 *    com `assertCarFitsDocument` já barrando save por tamanho hoje. Uma folha
 *    de dino escaneada tem 200-800 KB: seria, sozinha, o maior campo do
 *    documento — e derrubaria o save de quem já tem quatro fotos.
 * 2. A foto não prova nada que a gente consiga checar. Um gráfico de dino não
 *    tem placa, não tem chassi e não tem como ser amarrado a este exemplar.
 *    Guardar 500 KB para exibir uma prova que não prova é o pior negócio da
 *    arquitetura.
 * 3. O que dá procedência de verdade cabe em 70 bytes: NOME DA OFICINA e DATA.
 *    Isso é verificável socialmente — a Comunidade conhece os preparadores — e
 *    é o que a cultura de fato cita.
 *
 * Quem quiser mostrar a folha põe como uma das quatro fotos do carro, que já
 * existe, já comprime (`imageCompression.js`) e já tem teto. Zero código novo.
 */
export const SPEC_STORAGE_NOTE = "dyno-sheet-goes-to-the-existing-photo-gallery";

const normalizeVersionCorrections = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const out = {};
  for (const field of VERSION_FIELDS) {
    const value = raw[field.id];
    if (value === null || value === undefined || value === "") continue;

    if (field.values) {
      const candidate = typeof value === "number" ? value : String(value);
      if (field.values.includes(candidate)) out[field.id] = candidate;
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= field.min && numeric <= field.max) {
      out[field.id] = Math.round(numeric);
    }
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Ficha declarada normalizada, ou `null` quando não há nada dentro.
 *
 * `null` em vez de objeto vazio é de propósito: é assim que o resto do
 * `normalizeCar` já trabalha (`ownership`, `fipe`), e é o que permite a um
 * consumidor perguntar "esta pessoa mexeu na ficha?" sem inspecionar campo.
 */
export function normalizeSpecSheet(raw) {
  if (!raw || typeof raw !== "object") return null;

  const performance = {};
  for (const field of SPEC_FIELDS) {
    const entry = normalizeEntry(field, raw.performance?.[field.id]);
    if (entry) performance[field.id] = entry;
  }

  const mods = Array.isArray(raw.mods)
    ? MOD_CHIP_IDS.filter((id) => raw.mods.includes(id))
    : [];

  const version = normalizeVersionCorrections(raw.version);
  const stage = STAGES.includes(raw.stage) ? raw.stage : null;
  const notes = clean(raw.notes, SPEC_LIMITS.notes);

  const empty =
    !version && !Object.keys(performance).length && !mods.length && !stage && !notes;
  if (empty) return null;

  return {
    version,
    performance,
    mods,
    stage,
    notes,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validação plausível
// ---------------------------------------------------------------------------

export const SPEC_ISSUE = {
  /** Só isto impede de gravar, e só porque é erro de digitação, não opinião. */
  OUT_OF_PHYSICAL_RANGE: "out_of_physical_range",
  /** 220 cv com 30 Nm: quase certamente kgfm digitado como Nm. */
  TORQUE_UNIT_SUSPECT: "torque_unit_suspect",
  /** Declarou mais potência que a de fábrica sem marcar nada no motor. */
  POWER_ABOVE_FACTORY_WITHOUT_ENGINE_MOD: "power_above_factory_without_engine_mod",
  /** Marcou modificação de motor, mas o salto é grande até para preparação. */
  POWER_FAR_ABOVE_FACTORY: "power_far_above_factory",
  /** Potência por litro fora do que motor de rua entrega. */
  SPECIFIC_OUTPUT_IMPLAUSIBLE: "specific_output_implausible",
  /** Disse que é de fábrica e o número não bate com o de fábrica. */
  DECLARED_CONFLICTS_WITH_FACTORY: "declared_conflicts_with_factory",
  /** Marcou como modificado e não disse o que foi feito. */
  MODIFIED_WITHOUT_MODS: "modified_without_mods",
  /** Número na roda comparado com ficha no motor. */
  WHEEL_BASIS_NOT_COMPARABLE: "wheel_basis_not_comparable",
  /** GNV com ganho de potência declarado: a conversão tira, não põe. */
  GNV_WITH_POWER_GAIN: "gnv_with_power_gain",
  TOP_SPEED_IMPLAUSIBLE_FOR_POWER: "top_speed_implausible_for_power",
  ACCEL_IMPLAUSIBLE_FOR_POWER: "accel_implausible_for_power",
  /** Ficha de exemplar num carro que a pessoa ainda não tem. */
  SHEET_ON_GOAL_CAR: "sheet_on_goal_car",
  /**
   * A correção contradiz um token EXPLÍCITO da string da FIPE.
   *
   * Corrigir um campo que a FIPE não escreveu é a feature. Corrigir um campo
   * que ela escreveu com todas as letras é outra coisa: `KWID Zen 1.0 Flex 12V
   * 5p Mec.` marcado como diesel não é uma correção, é um Kwid a diesel — carro
   * que nunca existiu, e o mesmo tipo de impossibilidade que derrubou o
   * `consumption.js`. Não trava, mas pergunta: quase sempre a pessoa escolheu o
   * carro errado no cadastro, e é melhor descobrir isso agora.
   */
  VERSION_CORRECTION_CONTRADICTS_FIPE: "version_correction_contradicts_fipe",
};

export const ISSUE_SEVERITY = { BLOCK: "block", WARN: "warn", INFO: "info" };

/**
 * Potência específica que motor de RUA entrega, por litro. Teto de aviso, não
 * de bloqueio: existe Mobi de arrancada com 400 cv, e travar o cadastro dele
 * seria arrogância. O aviso diz "confere?", e quem sabe o que fez segue.
 *
 * Aspirado de rua raramente passa de 110-120 cv/L (o campeão de fábrica no
 * Brasil, o 2.0 do Civic Si, faz ~100). Turbo de rua preparado chega a 250-260
 * cv/L sem exotismo. Acima disso é motor de pista, e a frase muda de tom.
 */
const SPECIFIC_OUTPUT_CEILING = { natural: 120, forced: 260 };

const factoryPowerCv = (factory) => {
  const cell = factory?.fields?.powerCv;
  if (!cell || cell.status !== SPEC_STATUS.VALUE) return null;
  if (cell.pair) return Math.max(cell.pair.ethanol, cell.pair.gasoline);
  return cell.value ?? null;
};

const factoryTorqueNm = (factory) => {
  const cell = factory?.fields?.torque;
  if (!cell || cell.status !== SPEC_STATUS.VALUE) return null;
  const value = cell.pair ? Math.max(cell.pair.ethanol, cell.pair.gasoline) : cell.value;
  return toNm(value, cell.unit);
};

/**
 * Avisos, não bloqueios — com uma exceção: número fisicamente impossível.
 *
 * A régua, dita de uma vez: **eu não sou juiz do que a pessoa fez no carro
 * dela; eu sou testemunha do que é fisicamente estranho.** 400 cv num Mobi é
 * quase sempre mentira e é raramente um projeto sério de arrancada — os dois
 * casos merecem a mesma pergunta e nenhum deles merece uma porta trancada.
 *
 * @param {object} sheet ficha já normalizada
 * @param {{factory?: object, carType?: string}} context
 * @returns {{code: string, field: string|null, severity: string, data: object}[]}
 */
export function validateSpecSheet(sheet, context = {}) {
  const issues = [];
  if (!sheet) return issues;

  const add = (code, field, severity, data = {}) =>
    issues.push({ code, field, severity, data });

  const { factory } = context;
  const mods = sheet.mods || [];
  const hasEngineMod = mods.some((id) => ENGINE_CHIPS.has(id));
  const power = sheet.performance?.powerCv || null;
  const torque = sheet.performance?.torque || null;
  const factoryPower = factoryPowerCv(factory);
  const displacement = factory?.parsed?.displacement?.value || null;
  const forced =
    factory?.parsed?.aspiration?.value && factory.parsed.aspiration.value !== ASPIRATION.NATURAL;

  // Correção que contradiz token explícito da FIPE. `rawParsed` é o parser ANTES
  // das correções — depois delas a contradição já sumiu, e é justamente ela que
  // se quer ver.
  const rawParsed = context.rawParsed;
  if (rawParsed && sheet.version) {
    for (const [key, value] of Object.entries(sheet.version)) {
      const original = key === "doors" ? rawParsed.body?.doors : rawParsed[key];
      if (!original || original.confidence !== "explicit") continue;
      if (original.value !== value) {
        add(SPEC_ISSUE.VERSION_CORRECTION_CONTRADICTS_FIPE, key, ISSUE_SEVERITY.WARN, {
          fipeValue: original.value,
          declaredValue: value,
          evidence: original.evidence || "",
        });
      }
    }
  }

  if (context.carType === "goal") {
    // Não bloqueia: carro-meta vira carro possuído quando a pessoa compra, e
    // apagar o que ela escreveu seria pior. Mas a tela precisa saber.
    add(SPEC_ISSUE.SHEET_ON_GOAL_CAR, null, ISSUE_SEVERITY.INFO);
  }

  if (sheet.performance) {
    for (const [id, entry] of Object.entries(sheet.performance)) {
      if (entry.origin === SPEC_LAYER.MODIFIED && !mods.length && !sheet.stage) {
        add(SPEC_ISSUE.MODIFIED_WITHOUT_MODS, id, ISSUE_SEVERITY.WARN);
      }
    }
  }

  if (power) {
    if (power.basis === POWER_BASIS.WHEEL && factoryPower) {
      // Não é erro; é incomparável. A ficha de fábrica é no motor, sempre.
      add(SPEC_ISSUE.WHEEL_BASIS_NOT_COMPARABLE, "powerCv", ISSUE_SEVERITY.INFO, {
        factoryPower,
      });
    }

    if (factoryPower) {
      const ratio = power.value / factoryPower;
      if (ratio > 1.15 && !hasEngineMod) {
        add(SPEC_ISSUE.POWER_ABOVE_FACTORY_WITHOUT_ENGINE_MOD, "powerCv", ISSUE_SEVERITY.WARN, {
          factoryPower,
          ratio: round(ratio, 2),
        });
      }
      if (ratio > 3) {
        add(SPEC_ISSUE.POWER_FAR_ABOVE_FACTORY, "powerCv", ISSUE_SEVERITY.WARN, {
          factoryPower,
          ratio: round(ratio, 2),
        });
      }
      if (
        power.origin === SPEC_LAYER.DECLARED &&
        power.basis !== POWER_BASIS.WHEEL &&
        Math.abs(ratio - 1) > 0.12
      ) {
        // Camada 2 diverge da fábrica: quase sempre é o número de OUTRA versão,
        // que é exatamente como dado errado entra numa ficha técnica.
        add(SPEC_ISSUE.DECLARED_CONFLICTS_WITH_FACTORY, "powerCv", ISSUE_SEVERITY.WARN, {
          factoryPower,
        });
      }
    }

    if (displacement) {
      const specific = power.value / displacement;
      const ceiling = forced || mods.includes("turbo") ? SPECIFIC_OUTPUT_CEILING.forced : SPECIFIC_OUTPUT_CEILING.natural;
      if (specific > ceiling) {
        add(SPEC_ISSUE.SPECIFIC_OUTPUT_IMPLAUSIBLE, "powerCv", ISSUE_SEVERITY.WARN, {
          specific: round(specific, 0),
          ceiling,
          displacement,
        });
      }
    }

    if (mods.includes("gnv") && !hasEngineMod && factoryPower && power.value > factoryPower) {
      add(SPEC_ISSUE.GNV_WITH_POWER_GAIN, "powerCv", ISSUE_SEVERITY.WARN, { factoryPower });
    }
  }

  if (power && torque) {
    // Relação torque/potência de motor de pistão de rua fica entre ~0,7 e ~3,5
    // Nm por cv (o alto é diesel). Fora disso, a suspeita número um é unidade
    // trocada: 30 kgfm digitado como 30 Nm.
    const ratio = toNm(torque.value, torque.unit) / power.value;
    if (ratio < 0.5 || ratio > 4.5) {
      add(SPEC_ISSUE.TORQUE_UNIT_SUSPECT, "torque", ISSUE_SEVERITY.WARN, {
        ratio: round(ratio, 2),
        suggestedUnit: ratio < 0.5 ? "kgfm" : "Nm",
      });
    }
  }

  if (torque) {
    // A mesma checagem do par declarado x fábrica, mas em Nm dos dois lados: a
    // tabela do Han publica kgfm em umas linhas e Nm em outras, e comparar 20,4
    // com 200 sem converter produziria um "conflito" que não existe.
    const factoryTorque = factoryTorqueNm(factory);
    const declaredTorque = toNm(torque.value, torque.unit);
    if (
      factoryTorque &&
      torque.origin === SPEC_LAYER.DECLARED &&
      torque.basis !== POWER_BASIS.WHEEL &&
      Math.abs(declaredTorque / factoryTorque - 1) > 0.12
    ) {
      add(SPEC_ISSUE.DECLARED_CONFLICTS_WITH_FACTORY, "torque", ISSUE_SEVERITY.WARN, {
        factoryTorqueNm: round(factoryTorque, 1),
      });
    }
  }

  const effectivePower = power?.value || factoryPower;
  const topSpeed = sheet.performance?.topSpeedKmh;
  if (topSpeed && effectivePower && topSpeed.value > 250 && effectivePower < 200) {
    add(SPEC_ISSUE.TOP_SPEED_IMPLAUSIBLE_FOR_POWER, "topSpeedKmh", ISSUE_SEVERITY.WARN, {
      power: effectivePower,
    });
  }

  const accel = sheet.performance?.accel0to100S;
  if (accel && effectivePower && accel.value < 4 && effectivePower < 300) {
    add(SPEC_ISSUE.ACCEL_IMPLAUSIBLE_FOR_POWER, "accel0to100S", ISSUE_SEVERITY.WARN, {
      power: effectivePower,
    });
  }

  return issues;
}

/**
 * Valida ANTES de normalizar, para a tela poder explicar o que vai sumir.
 * `normalizeSpecSheet` descarta valor fora da faixa física em silêncio, porque
 * o banco não pode guardar impossível; quem avisa a pessoa é isto aqui.
 */
export function validateRawEntry(fieldId, raw) {
  const fieldDef = SPEC_FIELD_BY_ID.get(fieldId);
  if (!fieldDef || !raw) return [];

  const value = Number(raw.value);
  if (!Number.isFinite(value)) return [];

  const unit = fieldDef.units?.includes(raw.unit) ? raw.unit : fieldDef.unit;
  const min = unit === "Nm" && fieldDef.hardMinNm ? fieldDef.hardMinNm : fieldDef.hardMin;
  const max = unit === "Nm" && fieldDef.hardMaxNm ? fieldDef.hardMaxNm : fieldDef.hardMax;

  return value < min || value > max
    ? [
        {
          code: SPEC_ISSUE.OUT_OF_PHYSICAL_RANGE,
          field: fieldId,
          severity: ISSUE_SEVERITY.BLOCK,
          data: { min, max, unit },
        },
      ]
    : [];
}

// ---------------------------------------------------------------------------
// Resolução das três camadas
// ---------------------------------------------------------------------------

/**
 * Aplica as correções de identidade em cima do que o parser leu, ANTES de
 * consultar as tabelas. É o que transforma "não sabemos se é turbo" em uma
 * ficha inteira preenchida.
 */
const applyVersionCorrections = (parsed, corrections) => {
  if (!corrections) return { parsed, corrected: new Set() };

  const corrected = new Set();
  const next = { ...parsed, body: { ...parsed.body } };

  const put = (key, value) => {
    const cell = { value, confidence: "declared", evidence: "informado pelo dono" };
    if (key === "doors") next.body = { ...next.body, doors: cell };
    else next[key] = cell;
    corrected.add(key);
  };

  for (const [key, value] of Object.entries(corrections)) {
    if (!VERSION_FIELD_BY_ID.has(key)) continue;
    put(key, value);
  }
  return { parsed: next, corrected };
};

const FIELD_ORDER = [
  "powerCv",
  "torque",
  "accel0to100S",
  "topSpeedKmh",
  "engineFamily",
  "displacement",
  "valves",
  "aspiration",
  "fuel",
  "transmission",
  "drivetrain",
  "doors",
  "bodyStyle",
];

const declaredCell = (id, entry, factoryCell) => {
  const factoryHasValue = factoryCell?.status === SPEC_STATUS.VALUE;

  return {
    id,
    status: SPEC_STATUS.VALUE,
    reason: null,
    value: entry.value,
    pair: null,
    unit: entry.unit,
    origin: entry.origin,
    method: entry.method,
    basis: entry.basis,
    fuelBasis: entry.fuelBasis,
    confidence: null,
    scope: null,
    source:
      entry.method === SPEC_METHOD.DYNO
        ? { doc: entry.shop || "", url: "", layer: null, date: entry.date || null, verifiedAt: null }
        : null,
    note: entry.note || "",
    // O valor de fábrica que este número cobriu, quando existia um.
    //
    // Ele é guardado nas DUAS camadas, e por motivos opostos:
    //   - camada 3, é o delta: "de fábrica 150 cv → hoje 220 cv", a história
    //     que a pessoa quer contar;
    //   - camada 2, é um CONFLITO: ela disse que o carro é de fábrica e deu um
    //     número diferente do de fábrica. Mostro o dela, porque o carro é dela,
    //     mas não escondo o outro — quase sempre é o número de outra versão, e
    //     é assim que dado errado entra numa ficha técnica.
    // Quem desenha a seta é a tela, e só para camada 3. Ver `deltas`.
    replaces: factoryHasValue ? factoryCell : null,
    // Camada 2 preenchendo buraco: complementa, não substitui, e a tela não
    // deve desenhar seta nenhuma.
    fills: factoryHasValue ? null : factoryCell,
  };
};

/**
 * A ficha inteira do carro, resolvida nas três camadas.
 *
 * Cada campo volta com `status` (value/absent/held), `origin` (a camada),
 * `originTag` (o rótulo de quatro valores para a tela) e, quando houve
 * substituição, o valor de fábrica que ele substituiu.
 *
 * Função pura: não lê banco, não lê React, não escreve nada.
 *
 * @param {object} car documento do carro já normalizado
 */
export function resolveVehicleSpecSheet(car) {
  const sheet = normalizeSpecSheet(car?.specs);
  const rawParsed = parseFipeVersion(car || {});
  const { parsed, corrected } = applyVersionCorrections(rawParsed, sheet?.version);
  const factory = getFactorySpecs(car || {}, { parsed });

  const fields = {};
  for (const id of FIELD_ORDER) {
    const factoryCell = factory.fields[id] || null;
    const entry = sheet?.performance?.[id] || null;

    if (entry) {
      fields[id] = declaredCell(id, entry, factoryCell);
      continue;
    }

    if (factoryCell && corrected.has(id)) {
      // Campo de identidade que a própria pessoa corrigiu: é dela, não da FIPE.
      fields[id] = {
        ...factoryCell,
        origin: SPEC_LAYER.DECLARED,
        method: SPEC_METHOD.OWNER,
        source: null,
        confidence: null,
      };
      continue;
    }

    fields[id] = factoryCell;
  }

  // Campo que só existe PORQUE a pessoa corrigiu outro campo. Vale dizer na
  // tela: "apareceu porque você confirmou que é turbo".
  //
  // Medido por diferença contra a ficha sem correção nenhuma, e não deduzido de
  // "tem valor e foi corrigido": quem corrige as portas de um Polo 200 TSI não
  // destravou a potência, ela já estava lá. Dizer que destravou seria dar
  // crédito falso à pessoa, que é uma mentira pequena e mesmo assim uma
  // mentira.
  const unlockedBy = [];
  if (corrected.size) {
    const semCorrecao = getFactorySpecs(car || {}, { parsed: rawParsed });
    for (const id of ["powerCv", "torque", "accel0to100S", "topSpeedKmh", "engineFamily"]) {
      if (corrected.has(id)) continue;
      if (fields[id]?.status !== SPEC_STATUS.VALUE) continue;
      if (fields[id]?.origin !== SPEC_LAYER.FACTORY) continue;
      if (semCorrecao.fields[id]?.status === SPEC_STATUS.VALUE) continue;
      unlockedBy.push(id);
    }
  }

  const list = FIELD_ORDER.map((id) => fields[id]).filter(Boolean);

  return {
    parsed,
    factory,
    sheet,
    fields,
    order: FIELD_ORDER,
    list,
    tags: Object.fromEntries(list.map((cell) => [cell.id, originTag(cell)])),
    // Só camada 3 vira seta na tela. Camada 2 que cobre um valor de fábrica é
    // conflito, não delta, e sai pelo `issues`.
    deltas: list.filter((cell) => cell.replaces && cell.origin === SPEC_LAYER.MODIFIED),
    conflicts: list.filter((cell) => cell.replaces && cell.origin === SPEC_LAYER.DECLARED),
    held: list.filter((cell) => cell.status === SPEC_STATUS.HELD),
    absent: list.filter((cell) => cell.status === SPEC_STATUS.ABSENT),
    corrections: [...corrected],
    unlockedBy,
    mods: sheet?.mods || [],
    stage: sheet?.stage || null,
    notes: sheet?.notes || "",
    hasModifications: Boolean(
      sheet &&
        (sheet.mods.length ||
          (sheet.stage && sheet.stage !== "stock") ||
          Object.values(sheet.performance).some(
            (entry) => entry.origin === SPEC_LAYER.MODIFIED,
          )),
    ),
    issues: validateSpecSheet(sheet, { factory, rawParsed, carType: car?.type }),
  };
}

// ---------------------------------------------------------------------------
// Fronteira com o simulador de custo (Xuria)
// ---------------------------------------------------------------------------

/**
 * O que o simulador precisa saber sobre modificação, e NADA além disso.
 *
 * A recomendação vai escrita aqui porque a decisão é dela e o dado é meu, e
 * porque a pior saída possível seria alguém ler `powerCv: 400` e multiplicar
 * alguma coisa por ele.
 *
 * NÃO recalcule custo em cima de um número declarado. Um 400 cv digitado é
 * alegação; não existe modelo nosso de consumo para stage 2; e um carro
 * modificado nem sempre é segurável nos mesmos termos. Trocar um número
 * conferido por um número declarado, em silêncio, seria repetir o erro do
 * `consumption.js` com roupa nova.
 *
 * O que eu recomendo, em ordem de valor:
 *
 * 1. `invalidateConsumptionEstimate` — quando há GNV ou modificação de motor, a
 *    estimativa por categoria do `consumption.js` deixa de descrever este
 *    carro. O certo NÃO é ajustar por um fator inventado: é devolver `null` e
 *    usar o consumo REAL dos abastecimentos, que o `expenses.js` já calcula a
 *    partir de dois abastecimentos. Menos número, e o número certo.
 * 2. `insuranceCaveat` — seguradora recusa ou exige apólice específica para
 *    carro modificado, e blindagem muda a classe inteira. Isso é ressalva e
 *    faixa de incerteza mais larga, não um multiplicador novo.
 * 3. `weightPenalty` — blindagem soma 150-200 kg. Afeta consumo e desempenho de
 *    verdade, e mesmo assim eu não daria número: é sinal, ela decide.
 */
export function specModificationSignals(car) {
  const sheet = normalizeSpecSheet(car?.specs);
  if (!sheet) {
    return {
      hasModifications: false,
      hasEngineModifications: false,
      hasGnv: false,
      hasArmoring: false,
      declaredPowerRatio: null,
      recommend: [],
    };
  }

  const mods = sheet.mods || [];
  const hasEngineModifications =
    mods.some((id) => ENGINE_CHIPS.has(id)) ||
    (sheet.stage && sheet.stage !== "stock") ||
    sheet.performance?.powerCv?.origin === SPEC_LAYER.MODIFIED;
  const hasGnv = mods.includes("gnv");
  const hasArmoring = mods.includes("armor");

  const factory = getFactorySpecs(car || {});
  const factoryPower = factoryPowerCv(factory);
  const declaredPower = sheet.performance?.powerCv?.value || null;

  const recommend = [];
  if (hasEngineModifications || hasGnv) recommend.push("invalidateConsumptionEstimate");
  if (hasEngineModifications || hasArmoring) recommend.push("insuranceCaveat");
  if (hasArmoring) recommend.push("weightPenalty");

  return {
    hasModifications: Boolean(mods.length || hasEngineModifications),
    hasEngineModifications: Boolean(hasEngineModifications),
    hasGnv,
    hasArmoring,
    declaredPowerRatio:
      factoryPower && declaredPower ? round(declaredPower / factoryPower, 2) : null,
    recommend,
  };
}

// ---------------------------------------------------------------------------
// Comunidade
// ---------------------------------------------------------------------------

/**
 * Recorte público da ficha declarada.
 *
 * DECISÃO, e ela é o oposto da que eu tomei para `ownership` e para o código
 * FIPE: ficha declarada ENTRA na Comunidade. Dado financeiro não vaza porque
 * ninguém pediu para mostrá-lo; ficha declarada existe PARA ser vista — é a
 * pessoa contando o que fez no carro dela, e a Comunidade é uma das três
 * entradas da feature desde o primeiro briefing.
 *
 * O que publico e o que não publico, e por quê:
 *
 *  - Vão os valores DECLARADOS e MODIFICADOS, cada um com `origin` e `method`.
 *    Sem essa etiqueta o payload seria um número solto, e número solto na
 *    Comunidade vira placar de cavalo inventado. A etiqueta não é enfeite: é a
 *    condição de o dado poder ser publicado.
 *  - NÃO vai nada de fábrica. Quem lê deriva a camada 1 do mesmo jeito que o
 *    dono — `brand`/`model`/`year` já são públicos e o parser roda no cliente.
 *    Publicar a camada 1 criaria uma cópia que envelhece sozinha quando a
 *    tabela do Han melhorar, e cópia velha de dado técnico é exatamente o
 *    defeito do `fipe-consumption-db.json`.
 *  - NÃO vai ficha de carro-meta. Ficha de exemplar é afirmação sobre um carro
 *    que a pessoa tem; num carro que ela ainda quer, seria afirmação sobre um
 *    carro que não existe. A edição já é liberada só para `owned`, e aqui a
 *    regra é repetida em vez de assumida.
 *  - `shop` e `date` do dinamômetro vão, porque são o que dá procedência.
 */
export function publicSpecSheet(car) {
  if (car?.type !== "owned") return null;

  const sheet = normalizeSpecSheet(car?.specs);
  if (!sheet) return null;

  const performance = {};
  for (const [id, entry] of Object.entries(sheet.performance)) {
    performance[id] = {
      value: entry.value,
      unit: entry.unit,
      // Estes três campos são obrigatórios no payload público. Um número sem
      // eles não pode ser desenhado como "declarado pelo dono", e é justamente
      // isso que impede a ficha de virar placar.
      origin: entry.origin,
      method: entry.method,
      basis: entry.basis,
      fuelBasis: entry.fuelBasis,
      shop: entry.shop || "",
      date: entry.date || "",
      note: entry.note || "",
    };
  }

  return {
    version: sheet.version,
    performance,
    mods: sheet.mods,
    stage: sheet.stage,
    notes: sheet.notes,
    // Marca o payload inteiro como afirmação do dono, para que nenhum leitor
    // precise inferir isso campo a campo.
    declaredByOwner: true,
  };
}

/** A edição é do exemplar, então só existe para carro que a pessoa tem. */
export function canEditSpecSheet(car) {
  return car?.type === "owned";
}

export const SPEC_MATCH_SCOPE = MATCH_SCOPE;
export const SPEC_ABSENT_REASON = ABSENT_REASON;
export { toKgfm, toNm };
