/**
 * Parser da nomenclatura FIPE.
 *
 * A FIPE não tem endpoint de ficha técnica, mas o NOME da versão já carrega
 * ficha: `ONIX HATCH LT 1.0 12V TB Flex 5p Aut.` diz cilindrada, válvulas,
 * aspiração, combustível, portas e câmbio. Este módulo transforma essa string
 * em campos, e — mais importante — em uma CHAVE DE MOTOR usável para casar com
 * uma tabela externa de potência/torque.
 *
 * Três regras que atravessam o arquivo inteiro:
 *
 * 1. CAMPO QUE NÃO DEU PARA EXTRAIR É AUSENTE (`null`), nunca um default.
 *    Quem consome precisa distinguir "não tem turbo" de "não sei se tem turbo".
 *    É o mesmo princípio de `expenses.js`, que devolve `null` em vez de uma
 *    média inventada.
 *
 * 2. CADA CAMPO CARREGA SUA PRÓPRIA CONFIANÇA. Extrair `1.0` é determinístico;
 *    concluir "aspirado porque não escreveram turbo" não é. Ver CONFIDENCE.
 *
 * 3. NADA AQUI DEPENDE DE REACT. Lógica pura, testável em Node.
 */

/**
 * Níveis de confiança, do mais forte para o mais fraco.
 *
 * Só `EXPLICIT` e `DERIVED` podem ir para a tela sem ressalva visual. Campo
 * `INFERRED` veio do nosso conhecimento de carro, não da string, e precisa
 * aparecer com peso visual diferente ou não aparecer.
 */
export const CONFIDENCE = {
  /** Lido literalmente de um token da string. */
  EXPLICIT: "explicit",
  /** Deduzido de forma determinística de tokens explícitos. */
  DERIVED: "derived",
  /** Conhecimento de domínio, não está escrito na string. */
  INFERRED: "inferred",
};

export const ASPIRATION = {
  NATURAL: "naturally_aspirated",
  TURBO: "turbo",
  BITURBO: "biturbo",
  SUPERCHARGED: "supercharged",
};

export const FUEL = {
  FLEX: "flex",
  GASOLINE: "gasoline",
  ETHANOL: "ethanol",
  DIESEL: "diesel",
  ELECTRIC: "electric",
  HYBRID: "hybrid",
  PLUGIN_HYBRID: "plugin_hybrid",
  CNG: "cng",
};

export const TRANSMISSION = {
  MANUAL: "manual",
  AUTOMATIC: "automatic",
  /** Automatizado de embreagem simples: I-Motion, Dualogic, Easytronic. */
  AUTOMATED: "automated",
  CVT: "cvt",
  /** Dupla embreagem: DSG, DCT, Powershift, EDC. */
  DUAL_CLUTCH: "dual_clutch",
};

/** Motivos pelos quais um campo ficou desconhecido, para depuração e tela. */
export const AMBIGUITY = {
  MULTIPLE_DISPLACEMENTS: "multiple_displacements",
  MULTIPLE_DOORS: "multiple_doors",
  MULTIPLE_POWERS: "multiple_powers",
  UNMARKED_ASPIRATION: "unmarked_aspiration",
  AMBIGUOUS_ASPIRATION_GROUP: "ambiguous_aspiration_group",
  NO_DISPLACEMENT: "no_displacement",
  ELECTRIC_HAS_NO_DISPLACEMENT: "electric_has_no_displacement",
};

const field = (value, confidence, evidence) =>
  value === null || value === undefined
    ? null
    : { value, confidence, evidence: evidence || "" };

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------

/**
 * A FIPE escreve `GM - Chevrolet`, `VW - VolksWagen`, `Kia Motors`. Qualquer
 * tabela externa vem com o nome comercial limpo, então a normalização é nossa.
 * O mapa cobre só o que a FIPE realmente escreve diferente do usual; o resto
 * cai na regra genérica (tira prefixo `XX - `, colapsa espaço, Title Case).
 */
const BRAND_ALIASES = {
  "gm - chevrolet": "Chevrolet",
  "vw - volkswagen": "Volkswagen",
  "kia motors": "Kia",
  "caoa chery/chery": "Chery",
  "caoa chery": "Chery",
  "citroën": "Citroen",
  "land rover": "Land Rover",
  "mercedes-benz": "Mercedes-Benz",
  "gm": "Chevrolet",
  "vw": "Volkswagen",
};

export function normalizeFipeBrand(raw) {
  const clean = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";

  const key = clean.toLowerCase();
  if (BRAND_ALIASES[key]) return BRAND_ALIASES[key];

  // `GM - Chevrolet` / `VW - VolksWagen`: a sigla antes do hífen é redundante.
  const withoutPrefix = clean.replace(/^[A-Z]{2,3}\s*-\s*/i, "");
  const prefixKey = withoutPrefix.toLowerCase();
  if (BRAND_ALIASES[prefixKey]) return BRAND_ALIASES[prefixKey];

  return withoutPrefix;
}

// ---------------------------------------------------------------------------
// Ano
// ---------------------------------------------------------------------------

/**
 * FIPE usa `32000` como código de ano para veículo zero quilômetro. Não é um
 * ano; é uma sentinela. Sem tratar isso, um Onix zero vira "modelo 32000".
 */
const FIPE_ZERO_KM_YEAR = 32000;

const YEAR_FUEL_MAP = {
  gasolina: FUEL.GASOLINE,
  álcool: FUEL.ETHANOL,
  alcool: FUEL.ETHANOL,
  etanol: FUEL.ETHANOL,
  flex: FUEL.FLEX,
  diesel: FUEL.DIESEL,
  elétrico: FUEL.ELECTRIC,
  eletrico: FUEL.ELECTRIC,
  híbrido: FUEL.HYBRID,
  hibrido: FUEL.HYBRID,
};

/**
 * `2022 Gasolina` -> { modelYear: 2022, yearFuel: 'gasoline', isZeroKm: false }
 *
 * Atenção ao campo de combustível daqui: ele é um balde de quatro posições e
 * MENTE por omissão histórica — ver `resolveFuel`.
 */
export function parseFipeYear(raw) {
  const clean = String(raw || "").trim();
  const match = clean.match(/^(\d{4,5})\s*(.*)$/);
  if (!match) return { modelYear: null, yearFuel: null, isZeroKm: false };

  const numeric = Number(match[1]);
  const isZeroKm = numeric === FIPE_ZERO_KM_YEAR;
  const label = match[2].trim().toLowerCase();

  return {
    modelYear: isZeroKm ? null : numeric,
    yearFuel: YEAR_FUEL_MAP[label] || null,
    isZeroKm,
  };
}

// ---------------------------------------------------------------------------
// Aspiração — o campo mais crítico deste arquivo
// ---------------------------------------------------------------------------

/**
 * Um 1.0 aspirado e um 1.0 turbo do mesmo fabricante diferem ~40% em potência.
 * Errar aqui não é mostrar menos, é mostrar o número de outro carro com cara de
 * certeza. Então a régua é: só afirma turbo quem viu marcador.
 *
 * A lista é grande de propósito porque a FIPE NÃO padroniza. Casos reais da
 * base que quebram um regex ingênuo de /TB|Turbo/:
 *   - `Polo Comfortline TSI 1.0 Flex 12V Aut.`  -> turbo, marcado só por TSI
 *   - `Nivus Comfortline 1.0 200 TSI Flex Aut.` -> turbo, código comercial
 *   - `PULSE TRIBUTO 125 1.0 TB. 200 Flex Aut.` -> `TB.` com ponto
 *   - `Fastback Tributo 125 1.0 Turb. Flex Aut` -> `Turb.` abreviado
 */
const ASPIRATION_MARKERS = [
  // Dois turbos / turbo + compressor: potência ainda mais distante do aspirado.
  { re: /\bBI[-\s.]?(TB|TURBO)\b/i, value: ASPIRATION.BITURBO },
  { re: /\bTWIN[-\s]?TURBO\b/i, value: ASPIRATION.BITURBO },
  { re: /\bTSI\s*BLUEMOTION\b/i, value: ASPIRATION.TURBO },
  { re: /\bTFSI\b/i, value: ASPIRATION.TURBO },
  { re: /\bTSI\b/i, value: ASPIRATION.TURBO },
  { re: /\bTDI\b/i, value: ASPIRATION.TURBO },
  // T-GDI é turbo; GDI puro é só injeção direta e NÃO é turbo (Kia Niro 1.6
  // GDI é aspirado). Nunca colapsar os dois.
  { re: /\bT[-\s]?GDI\b/i, value: ASPIRATION.TURBO },
  { re: /\bT[-\s]?JET\b/i, value: ASPIRATION.TURBO },
  // `EcoBo.` aparece truncado quando o nome estoura o limite de caracteres da
  // FIPE — `TERRITORY Titanium 1.5 GTDi EcoBo. Aut.`.
  { re: /\bECOBOO?S?T?\b|\bECOBO\./i, value: ASPIRATION.TURBO },
  { re: /\bGTDI\b/i, value: ASPIRATION.TURBO },
  { re: /\bTHP\b/i, value: ASPIRATION.TURBO },
  { re: /\bTCE\b/i, value: ASPIRATION.TURBO },
  { re: /\bSUPERCHARGED\b|\bS\/C\b/i, value: ASPIRATION.SUPERCHARGED },
  { re: /\bTURBO\b/i, value: ASPIRATION.TURBO },
  { re: /\bTURB\./i, value: ASPIRATION.TURBO },
  { re: /\bTB\b\.?/i, value: ASPIRATION.TURBO },
  { re: /\bTB[-\s]?IC\b/i, value: ASPIRATION.TURBO },
  // Códigos comerciais Stellantis/VW que só existem em versão turbo. O código
  // aparece antes OU depois do `T`: `T270 1.3 TB` e `1.0 200 T. Flex`.
  { re: /\bT\.?\s?2(00|70|20|50)\b/i, value: ASPIRATION.TURBO },
  { re: /\b2(00|70)\s?T\b\.?/i, value: ASPIRATION.TURBO },
  { re: /\b(200|250|270|300|350)\s?TSI\b/i, value: ASPIRATION.TURBO },
  // Diesel de arquitetura turbo por definição do fabricante.
  { re: /\bTDV\d\b/i, value: ASPIRATION.TURBO },
  { re: /\bD[CE]I\b/i, value: ASPIRATION.TURBO },
  { re: /\bCRDI\b/i, value: ASPIRATION.TURBO },
  { re: /\b(BLUE)?HDI\b/i, value: ASPIRATION.TURBO },
  { re: /\bMULTIJET\b/i, value: ASPIRATION.TURBO },
  { re: /\bJTD\b/i, value: ASPIRATION.TURBO },
  { re: /\bMSDT\b/i, value: ASPIRATION.TURBO },
  { re: /\bD4[-\s]?D\b/i, value: ASPIRATION.TURBO },
  // Volvo: T-4/T-5/T-6/T-8 são todos sobrealimentados. RESTRITO À VOLVO de
  // propósito: sem a trava de marca, `CLASSIC R/T 5.7 CD V8` da RAM casava com
  // `T 5` e produzia um Hemi 5.7 turbo — motor que não existe. Foi o teste de
  // carro impossível que pegou, não o regex.
  { re: /\bT[-\s]?[45678]\b/i, value: ASPIRATION.TURBO, brands: ["Volvo"] },
  // Land Rover / Jaguar: Si4, Sd4, TD4/TD5/TD6 e a família P###/D### (Ingenium)
  // são todas sobrealimentadas. Sem isso o Evoque Si4 sai como aspirado.
  {
    re: /\bS[ID]\d\b|\bTD\d\b|\b[PD][2-6]\d{2}E?\b/i,
    value: ASPIRATION.TURBO,
    brands: ["Land Rover", "Jaguar"],
  },
  { re: /\bKOMPRESSOR\b/i, value: ASPIRATION.SUPERCHARGED },

  // -------------------------------------------------------------------------
  // ASPIRAÇÃO NATURAL DECLARADA. Entram POR ÚLTIMO, e a posição é a garantia:
  // qualquer marcador de sobrealimentação acima já retornou antes de chegar
  // aqui, então `Golf GTi 1.8 Mi 20V Turbo` sai turbo mesmo tendo marcador de
  // injeção.
  //
  // O que estes tokens declaram é a TOPOLOGIA DE INJEÇÃO (multiponto, ponto
  // único), não a aspiração — e multiponto com turbo existe: o 1.4 T-Jet da
  // Fiat e o 1.8 20V da VW são multiponto sobrealimentados. Portanto isto NÃO
  // é uma lei de motor, é uma regra do vocabulário da FIPE, e vale só porque
  // foi medida nele: 317 versões das 4.864 trazem um destes tokens e NENHUMA
  // traz marcador de sobrealimentação junto (17/08/2026). Os turbo-multiponto
  // da base escrevem `Turbo` com todas as letras — `Punto T-JET 1.4 16V Turbo`,
  // `Golf GTI 1.8 Turbo`.
  //
  // Sai como DERIVED, não EXPLICIT: a string não escreveu "aspirado", ela
  // escreveu "multiponto" e quem concluiu o resto foi a regra acima. DERIVED
  // basta para escapar da abstenção por grupo ambíguo, que só age sobre
  // INFERRED — a abstenção existe para o silêncio da FIPE, e aqui ela falou.
  //
  // FICARAM DE FORA, e cada exclusão tem contraexemplo medido na própria base:
  //   `Mi`   — VW usa em turbo: `Gol 1000 Mi 16V 2p Turbo`, `Polo GTI 1.8 Mi
  //            150cv 20V Turbo`. 12 ocorrências com turbo. É justamente o que
  //            torna o grupo Volkswagen|GOL|1.0|gasoline ambíguo.
  //   `i.e.` — `Uno Turbo 1.4 i.e.`, `Tempra Turbo 2.0 i.e.`. 3 em 20.
  //   `EFI`  — mesma classe do `i.e.`: diz que a injeção é eletrônica e nada
  //            sobre a mistura. Zero ganho medido (nenhum grupo ambíguo).
  //   `Fire`, `8V`, `Fire EVO` — família e número de válvulas não são
  //            aspiração. O 1.4 T-Jet é um Fire turbo e o Uno Turbo i.e. é um
  //            8V turbo; os dois existiram e são brasileiros.
  //   `SPE/4`, `E.torQ`, `aspirado` — não aparecem na base (0 ocorrências).
  //            Entrariam só para engordar a lista.
  {
    re: /\b(MPI|MSI|MPFI|SPI|SFI)\b/i,
    value: ASPIRATION.NATURAL,
    confidence: CONFIDENCE.DERIVED,
  },
];

/**
 * Códigos comerciais que SÃO a designação do motor e implicam a cilindrada.
 * Só entram quando a string não traz `d.d` — `Fastback Audace 200 TB Aut` não
 * tem cilindrada escrita em lugar nenhum, e o T200 da Stellantis é o 1.0 turbo.
 * Sai como INFERRED porque veio do nosso conhecimento, não do texto.
 */
const ENGINE_CODE_DISPLACEMENT = [
  // Stellantis (Fiat/Jeep): T200 = 1.0 turbo flex, T270 = 1.3 turbo flex.
  // `1.0 200 T. Flex`, `Turbo 200`, `T200`: o mesmo motor escrito de três
  // jeitos. Sem `\b` no fim porque o token termina em ponto.
  { re: /\bT\.?\s?200\b|\b200\s?T[B.]|\bTURBO\s?200\b/i, value: 1.0 },
  { re: /\bT\.?\s?270\b|\b270\s?T[B.]/i, value: 1.3 },
  // VW: 200 TSI = 1.0, 250 TSI = 1.4, 350 TSI = 2.0. Numeração diferente da
  // Stellantis para a mesma faixa — não dá para unificar as duas famílias.
  { re: /\b200\s?TSI\b/i, value: 1.0 },
  { re: /\b250\s?TSI\b/i, value: 1.4 },
  { re: /\b350\s?TSI\b/i, value: 2.0 },
];

/**
 * Armadilha real e cara: em VW, `T.` seguido de `Flex` significa TOTAL FLEX, o
 * nome comercial do sistema bicombustível — NÃO turbo.
 *
 *   `CROSSFOX 1.6 T. Flex 16V 5p`     -> aspirado (EA111 16V, ~103 cv)
 *   `Gol Comfortline 1.0 T. Flex 8V`  -> aspirado
 *
 * Um Crossfox 1.6 turbo nunca existiu. Se o parser produzir um, o parser está
 * errado — e é assim que a checagem entra no teste, não no comentário.
 *
 * A exceção é a Fiat, que usa `T.` como abreviação de Turbo depois do código
 * comercial: `Fastback Impetus 200 T. Aut`. Por isso a regra de `T 200` acima
 * roda antes e este bloqueio só se aplica ao par `T. Flex`.
 */
const TOTAL_FLEX_TRAP = /\bT(OT)?\.?\s?FLEX\b/i;

// ---------------------------------------------------------------------------
// Combustível
// ---------------------------------------------------------------------------

const FLEX_MARKERS =
  /\b(FLEX(FUEL|POWER)?|F\.\s?(FLEX|POWER)|TOT(AL)?\.?\s?FLEX|HI[-\s]?(FLEX|POWER)|E[-\s]?FLEX|BI[-\s]?COMB)\b/i;
const DIESEL_MARKERS =
  /\b(DIESEL|DIES?\.?|INT\.?\s?DIES?\.?|TDI|D[CE]I|CRDI|(BLUE)?HDI|MULTIJET|JTD|TDV\d|MSDT|D4[-\s]?D|CTDI)\b/i;
const ELECTRIC_MARKERS = /\((EL[ÉE]TRIC[OA])\)|\bBEV\b|\bEV\b|\bE[-\s]?TRON\b/i;
const HYBRID_MARKERS = /\(H[IÍ]B(RIDO|R[IÍ]DO|\.)\)|\bH[IÍ]BRID[OA]\b|\bHYBRID\b|\bHEV\b/i;
const PLUGIN_MARKERS = /\bPHEV\b|\b4XE\b|\bRECHARGE\b|\bGTE\b|\b\d{2,3}E\b|\bP\d{3}E\b/i;
const CNG_MARKERS = /\bGNV\b|\bCNG\b/i;

/**
 * A contradição que NÃO é contradição, e que alguém vai tentar "consertar":
 *
 *   model = `ONIX HATCH LT 1.0 12V Flex 5p Mec.`   (diz Flex)
 *   year  = `2022 Gasolina`                        (diz Gasolina)
 *
 * O campo de combustível do ANO da FIPE tem quatro baldes e é herdado de uma
 * época em que flex não existia — a primeira ocorrência de `Flex` no campo de
 * ano na base é 2005. Para uma parte grande do acervo a FIPE simplesmente
 * classifica flex como "Gasolina". O nome da versão é a fonte mais específica
 * e ganha sempre que for mais específico.
 *
 * Precedência: elétrico/híbrido > diesel > flex > o que o ano disser.
 */
function resolveFuel(model, yearFuel) {
  if (ELECTRIC_MARKERS.test(model)) {
    return field(FUEL.ELECTRIC, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (PLUGIN_MARKERS.test(model) && HYBRID_MARKERS.test(model)) {
    return field(FUEL.PLUGIN_HYBRID, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (HYBRID_MARKERS.test(model)) {
    return field(FUEL.HYBRID, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (CNG_MARKERS.test(model)) {
    return field(FUEL.CNG, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (DIESEL_MARKERS.test(model)) {
    return field(FUEL.DIESEL, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (FLEX_MARKERS.test(model)) {
    return field(FUEL.FLEX, CONFIDENCE.EXPLICIT, "marcador no nome");
  }
  if (yearFuel === FUEL.GASOLINE) {
    // Pode ser flex mal classificado pela FIPE. Gasolina puro é o que o dado
    // diz, mas a confiança cai porque sabemos que o balde é impreciso.
    return field(FUEL.GASOLINE, CONFIDENCE.DERIVED, "campo de ano da FIPE");
  }
  if (yearFuel) {
    return field(yearFuel, CONFIDENCE.EXPLICIT, "campo de ano da FIPE");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Câmbio
// ---------------------------------------------------------------------------

const TRANSMISSION_MARKERS = [
  { re: /\bCVT\b|\bTI\s?CVT\b|\bX[-\s]?TRONIC\b|\bLINEARTRONIC\b|\bMULTIDRIVE\b/i, value: TRANSMISSION.CVT },
  { re: /\bDSG\b|\bDCT\b|\bPDK\b|\bTCT\b|\bPOWERSHIFT\b|\bS[-\s]?TRONIC\b|\bEDC\b/i, value: TRANSMISSION.DUAL_CLUTCH },
  // A FIPE trunca nomes longos para caber no campo: `Dualo.`, `Tipt.`,
  // `Tiptron.`. Truncar é a regra, não a exceção.
  { re: /\bI[-\s]?MOTION\b|\bIMOTION\b|\bEASYTRONIC\b|\bDUALO\w*\.?|\bDUAL\.?\b|\bASG\b|\bMTA\b|\bAUTOMATIZAD/i, value: TRANSMISSION.AUTOMATED },
  // `TIP` sozinho NÃO entra: casaria com o Fiat Tipo. Só `Tiptron...` ou o
  // truncado com ponto, `Tipt.`.
  { re: /\bAUT\b\.?|\bAUTOM[ÁA]TIC[OA]\b|\bTIPTRON\w*|\bTIPT?\./i, value: TRANSMISSION.AUTOMATIC },
  { re: /\bMEC\b\.?|\bMANUAL\b|\bMEC[ÂA]NICO\b|\bMT\b/i, value: TRANSMISSION.MANUAL },
];

// A Dualogic da Fiat é embreagem simples, não dupla. Fica no balde certo.
const DUALOGIC = /\bDUALOGIC\b/i;

// ---------------------------------------------------------------------------
// Carroceria e portas
// ---------------------------------------------------------------------------

const CAB_MARKERS = [
  { re: /\bCD\b|\bCAB\.?\s?DUPLA\b/i, value: "double" },
  { re: /\bCE\b|\bCAB\.?\s?EST/i, value: "extended" },
  { re: /\bCS\b|\bCAB\.?\s?SIMPLES\b/i, value: "single" },
];

const BODY_STYLE_MARKERS = [
  { re: /\bPICK[-\s]?UP\b|\bPICKUP\b/i, value: "pickup" },
  { re: /\bHATCH\b|\bHB\b/i, value: "hatch" },
  { re: /\bSED(AN|\.)\b|\bSD\.?\b|\bSEDAN\b/i, value: "sedan" },
  { re: /\bPERUA\b|\bSW\b|\bVARIANT\b|\bWAGON\b|\bWEEKEND\b|\bTOURER\b/i, value: "wagon" },
  { re: /\bCOUP[EÉ]\b|\bCUP[EÊ]\b/i, value: "coupe" },
  { re: /\bCABRIOLET\b|\bCONVERS[ÍI]VEL\b|\bROADSTER\b|\bCABRIO\b/i, value: "convertible" },
  { re: /\bFURG[ÃA]O\b|\bVAN\b|\bMINIBUS\b/i, value: "van" },
];

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

/** Números de válvulas que um motor de passeio realmente tem. */
const PLAUSIBLE_VALVES = new Set([6, 8, 10, 12, 16, 20, 24, 32, 40, 48]);

/**
 * Cilindradas plausíveis para automóvel. Serve de guarda contra capturar
 * `4.0` de `4x4 CD 4.0` errado, ou um `1.5` que na verdade era uma versão.
 */
const MIN_DISPLACEMENT = 0.6;
const MAX_DISPLACEMENT = 8.4;

function extractDisplacement(model, ambiguities) {
  // Aceita `1.0`, `2.0`, colado (`CD2.0`, `1.0Mi`) e depois de abreviação
  // (`Ed.1.3`, `Dual.1.6`). O lookbehind só barra dígito, porque barrar ponto
  // também engolia justamente esses últimos.
  const found = model.match(/(?<!\d)(\d)\.(\d)(?!\d)/g) || [];
  const distinct = [
    ...new Set(
      found
        .map((raw) => Number(raw))
        .filter((n) => n >= MIN_DISPLACEMENT && n <= MAX_DISPLACEMENT),
    ),
  ];

  if (distinct.length === 1) {
    return field(distinct[0], CONFIDENCE.EXPLICIT, `token ${distinct[0].toFixed(1)}`);
  }
  if (distinct.length > 1) {
    // `Opala L/SL/SS/ 2.5/4.1` são duas motorizações num registro só. Escolher
    // uma é escolher a potência errada em metade dos casos.
    ambiguities.push(AMBIGUITY.MULTIPLE_DISPLACEMENTS);
    return null;
  }

  // A VW escreve cilindrada em centímetros cúbicos nas linhas antigas:
  // `Gol 1000 Mi 16V 2p Turbo`, `Parati 1000 Mi`, `Gol TSi 2000`.
  // O lookbehind de hífen/letra é o que impede `F-1000` e `F-4000` de virarem
  // uma picape de 1.0 — nome de modelo, não cilindrada. Foi assim que o
  // detector de carro impossível pegou o bug: uma F-1000 com motor 1.0 não
  // existe, e nenhuma validação de schema reclamaria dela.
  const cc = model.match(/(?<![\d.\-A-Za-z])\d{4}(?![\d.])/g) || [];
  const fromCc = [
    ...new Set(
      cc
        .map((raw) => Number(raw) / 1000)
        // Só centenas redondas: 1000, 1600, 2000. `2013` viraria 2.013 e cai
        // fora, que é o que impede um ano-modelo de virar cilindrada.
        .filter(
          (n) =>
            n >= MIN_DISPLACEMENT &&
            n <= MAX_DISPLACEMENT &&
            Math.round(n * 10) === Number((n * 10).toFixed(4)),
        ),
    ),
  ];
  if (fromCc.length === 1) {
    return field(fromCc[0], CONFIDENCE.DERIVED, "cilindrada em cm³ no nome");
  }

  // Último recurso: código comercial de motor (T200, 250 TSI). Conhecimento de
  // domínio, não texto — por isso INFERRED.
  for (const code of ENGINE_CODE_DISPLACEMENT) {
    if (code.re.test(model)) {
      return field(code.value, CONFIDENCE.INFERRED, `código de motor ${model.match(code.re)[0].trim()}`);
    }
  }

  ambiguities.push(AMBIGUITY.NO_DISPLACEMENT);
  return null;
}

/**
 * Válvulas, com guarda de plausibilidade física.
 *
 * A FIPE tem erro de digitação aqui: `Creta N Line 1.6 TB 12V Flex Aut.` —
 * não existe 1.6 de 12 válvulas, porque 12V implica três cilindros e nenhum
 * três-cilindros de 1.6 foi vendido no Brasil. Já `1.0 6V` (Firefly, três
 * cilindros SOHC) e `1.5 12V` (EcoBoost, três cilindros DOHC) são reais. A
 * regra separa os dois casos pela cilindrada em vez de listar motores.
 */
function extractValves(model, displacementValue) {
  const found = model.match(/(?<![\d.])(\d{1,2})\s?V\b/gi) || [];
  const distinct = [
    ...new Set(
      found
        .map((raw) => Number(raw.replace(/[^\d]/g, "")))
        .filter((n) => PLAUSIBLE_VALVES.has(n)),
    ),
  ];
  if (distinct.length !== 1) return null;

  const valves = distinct[0];
  if (displacementValue) {
    if (valves === 6 && displacementValue > 1.3) return null;
    if (valves === 12 && displacementValue > 1.5) return null;
  }
  return field(valves, CONFIDENCE.EXPLICIT, `token ${valves}V`);
}

/**
 * Cilindros só quando escritos: `V6`, `V8`, `I6`, `L4`. Não se deduz cilindro
 * de cilindrada — 1.0 pode ser 3 ou 4 cilindros dependendo da família, e
 * chutar isso é exatamente o tipo de número que ninguém confere.
 */
function extractCylinders(model) {
  const vShape = model.match(/\b[VIL](\d{1,2})\b/);
  if (vShape) {
    const n = Number(vShape[1]);
    if (n >= 3 && n <= 12) {
      return field(n, CONFIDENCE.EXPLICIT, `token ${vShape[0]}`);
    }
  }
  return null;
}

function extractAspiration(model, fuelValue, modelYear, brandName, ambiguities) {
  for (const marker of ASPIRATION_MARKERS) {
    // Marcador de escopo restrito só vale para a marca que o usa: a mesma
    // sigla significa coisas diferentes em fabricantes diferentes.
    if (marker.brands && !marker.brands.includes(brandName)) continue;
    if (marker.re.test(model)) {
      // `T. Flex` = Total Flex, não turbo. Só bloqueia se o marcador que casou
      // foi justamente o genérico `T?` — os demais (TSI, TB, TDI...) são
      // inequívocos e passam.
      const matched = model.match(marker.re)?.[0] || "";
      if (/^T\.?$/i.test(matched.trim()) && TOTAL_FLEX_TRAP.test(model)) {
        continue;
      }
      const token = matched.trim();
      return field(
        marker.value,
        marker.confidence || CONFIDENCE.EXPLICIT,
        marker.value === ASPIRATION.NATURAL
          ? `token ${token} (injeção multiponto) e nenhum marcador de sobrealimentação`
          : `token ${token}`,
      );
    }
  }

  // Diesel de passeio moderno é turbo por arquitetura: não se vende diesel
  // aspirado em automóvel no Brasil há duas décadas. Antes disso vendia-se
  // (Hilux 3.0 90 cv aspirada), então o corte é por ano e sem ano não afirma.
  if (fuelValue === FUEL.DIESEL && modelYear && modelYear >= 2005) {
    return field(ASPIRATION.TURBO, CONFIDENCE.INFERRED, "diesel de passeio pós-2005");
  }

  // Chegou aqui: NÃO há marcador. Isso NÃO é prova de aspirado — a FIPE omite.
  // `COMPASS Lon Nig. Eagle 1.3 4x2 Flex Aut.` é o T270 de 185 cv sem nenhum
  // marcador, e um Compass 1.3 aspirado nunca existiu. Por isso o valor sai
  // como INFERRED e a ambiguidade fica registrada: quem for casar com uma
  // tabela de motor deve ABSTER-SE se houver mais de um candidato.
  ambiguities.push(AMBIGUITY.UNMARKED_ASPIRATION);
  return field(
    ASPIRATION.NATURAL,
    CONFIDENCE.INFERRED,
    "ausência de marcador de sobrealimentação",
  );
}

function extractTransmission(model) {
  if (DUALOGIC.test(model)) {
    return field(TRANSMISSION.AUTOMATED, CONFIDENCE.EXPLICIT, "token Dualogic");
  }
  for (const marker of TRANSMISSION_MARKERS) {
    const matched = model.match(marker.re);
    if (matched) {
      return field(marker.value, CONFIDENCE.EXPLICIT, `token ${matched[0].trim()}`);
    }
  }
  return null;
}

function extractDoors(model, ambiguities) {
  // `5p`, `5P`, `3p.`, `2p e 4p`, e colado na abreviação anterior (`Aut.4p`).
  // O `\d+L` das vans é lugares, não portas.
  const found = model.match(/(?<!\d)([2-5])\s?[pP]\b/g) || [];
  const distinct = [...new Set(found.map((raw) => Number(raw.replace(/[^\d]/g, ""))))];
  if (distinct.length === 1) {
    return field(distinct[0], CONFIDENCE.EXPLICIT, `token ${distinct[0]}p`);
  }
  if (distinct.length > 1) {
    // `Gol 1000 Mi Plus 8v 2p e 4p` é um registro para duas carrocerias.
    ambiguities.push(AMBIGUITY.MULTIPLE_DOORS);
  }
  return null;
}

function extractFirstMatch(model, markers) {
  for (const marker of markers) {
    const matched = model.match(marker.re);
    if (matched) {
      return field(marker.value, CONFIDENCE.EXPLICIT, `token ${matched[0].trim()}`);
    }
  }
  return null;
}

/**
 * Potência que a própria FIPE escreveu no nome (`268cv`, `115cv`). Aparece em
 * ~12% da base e é o único dado de potência que temos hoje sem fonte externa.
 *
 * Par com barra NÃO é par flex. `Airtrek 2.4 16V 163cv/ 136cv` tem o maior
 * primeiro, e `Golf GTi 1.8 Mi 180/193cv` são dois anos-modelo distintos
 * agrupados. Como não dá para saber qual é qual, o par vira ambiguidade.
 */
function extractDeclaredPower(model, ambiguities) {
  const pairs = model.match(/\d{2,3}\s?(cv)?\s?\/\s?\d{2,3}\s?cv/i);
  if (pairs) {
    ambiguities.push(AMBIGUITY.MULTIPLE_POWERS);
    return null;
  }
  const single = model.match(/(?<![\d/])(\d{2,3})\s?cv\b/i);
  if (single) {
    const n = Number(single[1]);
    if (n >= 30 && n <= 1000) {
      return field(n, CONFIDENCE.EXPLICIT, `token ${single[0].trim()} (FIPE)`);
    }
  }
  return null;
}

/**
 * Nomes comerciais que a FIPE usa como cabeça da string. Serve só para separar
 * o nome do modelo do acabamento — sem esse dicionário não há como saber onde
 * o nome acaba e o trim começa, porque a FIPE não separa os dois.
 *
 * Cobre a frota brasileira contemporânea, não a base inteira. Modelo fora da
 * lista devolve `trim: null` em vez de um chute.
 */
const NAMEPLATES = [
  // Chevrolet
  "ONIX PLUS", "ONIX SEDAN", "ONIX HATCH", "ONIX", "PRISMA", "CRUZE SPORT6", "CRUZE",
  "TRACKER", "SPIN", "MONTANA", "S10", "EQUINOX", "COBALT", "CELTA", "CLASSIC",
  "AGILE", "CORSA", "MERIVA", "CAPTIVA", "TRAILBLAZER", "BOLT", "VECTRA",
  "ASTRA", "ZAFIRA", "BLAZER", "KADETT", "MONZA", "CHEVETTE", "IPANEMA",
  "OMEGA", "SUPREMA", "SILVERADO", "OPALA", "CARAVAN", "VERANEIO", "D20",
  // Volkswagen
  "T-CROSS", "NIVUS", "VIRTUS", "POLO TRACK", "POLO", "GOL", "VOYAGE", "SAVEIRO",
  "FOX", "CROSSFOX", "SPACEFOX", "SPACECROSS", "UP!", "UP", "JETTA", "TIGUAN",
  "TAOS", "TERA", "AMAROK", "GOLF", "PASSAT", "FUSCA", "KOMBI", "PARATI", "SANTANA",
  "QUANTUM", "BORA", "APOLLO", "LOGUS", "POINTER", "PASSAT VARIANT",
  // Fiat
  "ARGO", "CRONOS", "MOBI", "PULSE", "FASTBACK", "TORO", "STRADA", "FIORINO",
  "UNO", "PALIO", "SIENA", "GRAND SIENA", "PUNTO", "IDEA", "DOBLO", "LINEA",
  "500", "TITANO", "TEMPRA", "MAREA", "BRAVA", "STILO", "BRAVO", "ELBA",
  "PREMIO", "DUNA", "TIPO", "FREEMONT", "PALIO WEEKEND", "SIENA EL",
  // Hyundai
  "HB20S", "HB20X", "HB20", "CRETA", "TUCSON", "IX35", "SANTA FE", "I30", "AZERA",
  "ELANTRA", "KONA",
  // Toyota
  "COROLLA CROSS", "COROLLA", "YARIS CROSS", "YARIS", "ETIOS", "HILUX", "SW4",
  "RAV4", "CAMRY", "PRIUS",
  // Renault
  "KWID", "SANDERO", "LOGAN", "STEPWAY", "DUSTER", "OROCH", "CAPTUR", "KANGOO",
  "MASTER", "FLUENCE", "CLIO", "ZOE",
  // Honda
  "CIVIC", "CITY", "FIT", "HR-V", "WR-V", "CR-V", "ZR-V", "ACCORD",
  // Jeep
  "RENEGADE", "COMPASS", "COMMANDER", "WRANGLER", "GLADIATOR", "CHEROKEE",
  // Nissan
  "KICKS", "VERSA", "MARCH", "SENTRA", "FRONTIER", "X-TRAIL", "LEAF",
  "TIIDA", "LIVINA", "GRAND LIVINA",
  // Ford
  "KA+", "KA", "FIESTA", "ECOSPORT", "RANGER", "FOCUS", "FUSION", "EDGE",
  "TERRITORY", "BRONCO", "MAVERICK", "MUSTANG", "ESCORT", "VERONA", "DEL REY",
  "BELINA", "PAMPA", "COURIER", "F-250", "F-1000", "F-4000", "TRANSIT",
  // Peugeot / Citroen
  "208", "2008", "3008", "5008", "308", "408", "PARTNER", "EXPERT", "BOXER",
  "C3", "C4 CACTUS", "C4", "AIRCROSS", "BASALT",
  // Outras
  "TIGGO", "ARRIZO", "L200", "TRITON", "PAJERO", "ECLIPSE CROSS", "ASX", "OUTLANDER",
  "SPORTAGE", "CERATO", "SORENTO", "SELTOS", "PICANTO", "NIRO",
  "DOLPHIN", "SEAL", "SONG", "YUAN", "KING", "SEALION",
  "RAMPAGE", "DAKOTA", "CLASSIC 1500", "2500", "3500",
];

// Ordena do mais longo para o mais curto: `ONIX PLUS` precisa ganhar de `ONIX`,
// senão o trim do Onix Plus vira "PLUS ..." e o modelo vira "ONIX".
const NAMEPLATES_SORTED = [...NAMEPLATES].sort((a, b) => b.length - a.length);

/**
 * Tokens que marcam o fim do trim e o começo da ficha técnica. O trim é o que
 * sobra entre o nome do modelo e o primeiro token técnico.
 */
const SPEC_BOUNDARY =
  /(?<![\d.])\d\.\d|\b\d{1,2}\s?V\b|\bFLEX\b|\bTB\b|\bTSI\b|\bTURBO\b|\bDIESEL\b|\bAUT\b|\bMEC\b|\b[2-5]\s?[pP]\b|\b4X[24]\b|\b\d{2,3}\s?cv\b|\bV[68]\b|\bMI\b|\bMPI\b|\bMSI\b/i;

function extractNameplateAndTrim(model) {
  const upper = model.toUpperCase();
  const nameplate = NAMEPLATES_SORTED.find(
    (name) => upper.startsWith(`${name} `) || upper === name,
  );
  if (!nameplate) return { nameplate: null, trim: null };

  const rest = model.slice(nameplate.length).trim();
  const boundary = rest.search(SPEC_BOUNDARY);
  const trimText = (boundary === -1 ? rest : rest.slice(0, boundary))
    .replace(/[\s/,-]+$/, "")
    .trim();

  return {
    nameplate: field(
      model.slice(0, nameplate.length).trim(),
      CONFIDENCE.DERIVED,
      "dicionário de nomes comerciais",
    ),
    // Trim é o campo mais fraco do parser e sai como DERIVED de propósito: a
    // FIPE não separa nome de acabamento, então isto é um corte, não um dado.
    trim: trimText
      ? field(trimText, CONFIDENCE.DERIVED, "texto entre nome e ficha técnica")
      : null,
  };
}

/**
 * Grupos `marca|nome|cilindrada|combustível` em que a FIPE lista versões COM e
 * SEM marcador de sobrealimentação. Dentro deles, "não escreveram turbo" não
 * prova aspirado, e o parser se ABSTÉM em vez de servir a potência do motor
 * errado com cara de certeza.
 *
 * Não é uma lista de memória: sai medida da própria base FIPE por
 * `scripts/check-fipe-parser.mjs`, que compara, dentro de cada grupo, quantas
 * versões trazem marcador e quantas não trazem. Regenere quando a FIPE mudar.
 *
 * Medido em 17/08/2026 sobre 4.864 versões de 19 marcas: 67 grupos de risco,
 * cobrindo 316 das 3.074 versões cuja aspiração seria inferida (10,3%).
 *
 * O caso que justifica o mecanismo: `COMPASS Lon Nig. Eagle 1.3 4x2 Flex Aut.`
 * é o T270 de 185 cv sem nenhum marcador — e um Compass 1.3 aspirado nunca
 * existiu. Sem esta lista, ele receberia o número de um motor inexistente.
 */
const AMBIGUOUS_ASPIRATION_GROUPS = new Set([
  "BMW|328IA|2.0|flex",
  "BMW|M3|3.0|gasoline",
  "BMW|M|3.0|gasoline",
  "BMW|X1|2.0|flex",
  "BMW|X1|2.0|gasoline",
  "BMW|X3|3.0|gasoline",
  "BMW|X4|3.0|gasoline",
  "BMW|X5|3.0|gasoline",
  "BMW|X5|4.4|gasoline",
  "BMW|Z4|2.0|gasoline",
  "Chery|TIGGO|1.5|flex",
  "Chevrolet|ONIX HATCH|1.0|flex",
  "Chevrolet|ONIX HATCH|1.0|gasoline",
  "Chevrolet|ONIX SEDAN|1.0|flex",
  "Chevrolet|ONIX SEDAN|1.0|gasoline",
  "Chevrolet|ONIX|1.0|flex",
  "Fiat|500|1.4|gasoline",
  "Fiat|MAREA|2.0|gasoline",
  "Fiat|PULSE|1.3|flex",
  "Fiat|TEMPRA|2.0|gasoline",
  "Ford|FIESTA|1.0|gasoline",
  "Honda|ACCORD|2.0|gasoline",
  "Honda|CIVIC|2.0|gasoline",
  "Honda|HR-V|1.5|flex",
  "Hyundai|CRETA|1.6|flex",
  "Hyundai|HB20S|1.0|flex",
  "Hyundai|HB20|1.0|flex",
  "Hyundai|I20|1.0|gasoline",
  "Jeep|COMPASS|1.3|flex",
  "Jeep|COMPASS|2.0|gasoline",
  "Jeep|WRANGLER|2.0|gasoline",
  "Land Rover|DEFENDER|3.0|hybrid",
  "Land Rover|DISC.|2.0|hybrid",
  "Land Rover|DISCOVERY|2.0|flex",
  "Land Rover|DISCOVERY|2.0|hybrid",
  "Land Rover|DISCOVERY|3.0|gasoline",
  "Land Rover|RANGE|2.0|gasoline",
  "Land Rover|RANGE|2.0|hybrid",
  "Land Rover|RANGE|3.0|gasoline",
  "Land Rover|RANGE|3.0|hybrid",
  "Land Rover|RANGE|4.2|gasoline",
  "Land Rover|RANGE|4.4|gasoline",
  "Mitsubishi|LANCER|2.0|gasoline",
  "Peugeot|2008|1.6|flex",
  "Peugeot|208|1.0|flex",
  "Peugeot|208|1.6|flex",
  "Peugeot|308|1.6|flex",
  "Peugeot|308|1.6|gasoline",
  "Toyota|COROLLA|1.6|gasoline",
  "Volkswagen|GOLF|2.0|gasoline",
  "Volkswagen|GOL|1.0|gasoline",
  "Volkswagen|GOL|1.8|gasoline",
  "Volkswagen|GOL|2.0|gasoline",
  "Volkswagen|PARATI|1.0|gasoline",
  "Volkswagen|PASSAT VARIANT|1.8|gasoline",
  "Volkswagen|PASSAT VARIANT|2.0|gasoline",
  "Volkswagen|PASSAT|1.8|gasoline",
  "Volkswagen|PASSAT|2.0|gasoline",
  "Volkswagen|POLO|1.0|flex",
  "Volkswagen|POLO|1.8|gasoline",
  "Volkswagen|SAVEIRO|2.0|gasoline",
  "Volkswagen|TERA|1.0|flex",
  "Volkswagen|UP!|1.0|flex",
  "Volkswagen|VIRTUS|1.0|flex",
  "Volvo|S40|2.0|gasoline",
  "Volvo|S60|2.0|gasoline",
  "Volvo|V40|2.0|gasoline",
]);

/**
 * Chave do grupo de ambiguidade. Exportada para que o script de medição use
 * exatamente a mesma regra que o parser — lista gerada com uma chave e
 * consultada com outra é como um bug nasce.
 */
export function versionGroupKey(parsed) {
  const brand = parsed?.brand?.value;
  const displacement = parsed?.displacement?.value;
  const fuel = parsed?.fuel?.value;
  if (!brand || !displacement || !fuel) return null;

  // Sem nome comercial reconhecido, cai na primeira palavra da string — que é
  // o que a FIPE usa como cabeça e serve de agrupador razoável.
  const name = (
    parsed.nameplate?.value || parsed.raw.model.split(/\s+/)[0] || ""
  ).toUpperCase();
  if (!name) return null;

  return `${brand}|${name}|${displacement.toFixed(1)}|${fuel}`;
}

/**
 * Chave de junção com uma tabela externa de motor.
 *
 * `chevrolet|1.0|12|turbo|flex`. Só é emitida quando marca, cilindrada,
 * aspiração e combustível existem — e NUNCA para elétrico, porque motor
 * elétrico não tem cilindrada e casar por ela produziria lixo.
 *
 * O campo `confident` diz se a chave pode ser usada sozinha. Só a aspiração
 * INFERRED — a que veio da AUSÊNCIA de marcador — derruba a confiança; quem
 * consome precisa então checar se a tabela tem mais de um candidato para
 * marca+cilindrada+válvulas e, se tiver, abster-se. EXPLICIT (`TSI`, `TB`) e
 * DERIVED (`MPI` sem marcador de sobrealimentação) valem sozinhas: nos dois
 * casos a FIPE escreveu alguma coisa sobre o motor.
 */
export function buildEngineKey(parsed) {
  const brand = parsed?.brand?.value;
  const displacement = parsed?.displacement?.value;
  const aspiration = parsed?.aspiration?.value;
  const fuel = parsed?.fuel?.value;

  if (!brand || !displacement || !aspiration || !fuel) return null;
  if (fuel === FUEL.ELECTRIC) return null;

  const valves = parsed?.valves?.value;
  return {
    key: [
      brand.toLowerCase(),
      displacement.toFixed(1),
      valves ? String(valves) : "?",
      aspiration,
      fuel,
    ].join("|"),
    confident:
      parsed.aspiration.confidence !== CONFIDENCE.INFERRED &&
      parsed.displacement.confidence === CONFIDENCE.EXPLICIT,
  };
}

/**
 * Interpreta uma versão FIPE a partir dos três campos que já guardamos no
 * carro. Nunca lança: string estranha devolve tudo nulo e a lista de
 * ambiguidades explicando por quê.
 *
 * @param {{brand?: string, model?: string, year?: string}} car
 */
export function parseFipeVersion(car) {
  const rawBrand = String(car?.brand || "").trim();
  const rawModel = String(car?.model || "").replace(/\s+/g, " ").trim();
  const rawYear = String(car?.year || "").trim();

  const ambiguities = [];
  const { modelYear, yearFuel, isZeroKm } = parseFipeYear(rawYear);
  const brandName = normalizeFipeBrand(rawBrand);

  if (!rawModel) {
    return {
      raw: { brand: rawBrand, model: rawModel, year: rawYear },
      brand: brandName ? field(brandName, CONFIDENCE.EXPLICIT, "marca FIPE") : null,
      modelYear: modelYear ? field(modelYear, CONFIDENCE.EXPLICIT, "ano FIPE") : null,
      isZeroKm,
      nameplate: null,
      trim: null,
      displacement: null,
      valves: null,
      cylinders: null,
      aspiration: null,
      fuel: null,
      transmission: null,
      body: { doors: null, cab: null, style: null },
      drivetrain: null,
      declaredPowerCv: null,
      engineKey: null,
      ambiguities: [AMBIGUITY.NO_DISPLACEMENT],
    };
  }

  const fuel = resolveFuel(rawModel, yearFuel);
  const fuelValue = fuel?.value || null;

  const displacement =
    fuelValue === FUEL.ELECTRIC
      ? (ambiguities.push(AMBIGUITY.ELECTRIC_HAS_NO_DISPLACEMENT), null)
      : extractDisplacement(rawModel, ambiguities);

  let aspiration =
    fuelValue === FUEL.ELECTRIC
      ? null
      : extractAspiration(rawModel, fuelValue, modelYear, brandName, ambiguities);

  const { nameplate, trim } = extractNameplateAndTrim(rawModel);

  // Abstenção: se o grupo deste carro tem irmão sobrealimentado na FIPE, a
  // ausência de marcador não prova nada e o campo volta a ser desconhecido.
  // Mostrar menos é o comportamento correto; mostrar o motor do irmão não é.
  if (
    aspiration &&
    aspiration.confidence === CONFIDENCE.INFERRED &&
    aspiration.value === ASPIRATION.NATURAL
  ) {
    const groupKey = versionGroupKey({
      raw: { model: rawModel },
      brand: brandName ? { value: brandName } : null,
      displacement,
      fuel,
      nameplate,
    });
    if (groupKey && AMBIGUOUS_ASPIRATION_GROUPS.has(groupKey)) {
      ambiguities.push(AMBIGUITY.AMBIGUOUS_ASPIRATION_GROUP);
      aspiration = null;
    }
  }

  const parsed = {
    raw: { brand: rawBrand, model: rawModel, year: rawYear },
    brand: brandName ? field(brandName, CONFIDENCE.EXPLICIT, "marca FIPE") : null,
    modelYear: modelYear ? field(modelYear, CONFIDENCE.EXPLICIT, "ano FIPE") : null,
    isZeroKm,
    nameplate,
    trim,
    displacement,
    valves: extractValves(rawModel, displacement?.value || null),
    cylinders: extractCylinders(rawModel),
    aspiration,
    fuel,
    transmission: extractTransmission(rawModel),
    body: {
      doors: extractDoors(rawModel, ambiguities),
      cab: extractFirstMatch(rawModel, CAB_MARKERS),
      style: extractFirstMatch(rawModel, BODY_STYLE_MARKERS),
    },
    drivetrain: extractFirstMatch(rawModel, [
      { re: /\b4X4\b|\bAWD\b|\b4WD\b|\bXDRIVE\b|\bQUATTRO\b|\b4MATIC\b/i, value: "awd" },
      { re: /\b4X2\b|\bFWD\b|\b2WD\b/i, value: "fwd" },
    ]),
    declaredPowerCv: extractDeclaredPower(rawModel, ambiguities),
    ambiguities,
  };

  parsed.engineKey = buildEngineKey(parsed);
  return parsed;
}
