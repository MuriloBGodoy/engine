/**
 * A tradução entre o vocabulário do Brian e o da tela.
 *
 * Os serviços (`carSpecSheet.js`, `vehicleSpecs.js`, `fipeVersion.js`) nunca
 * devolvem string de tela — só código. Este arquivo é o único lugar onde um
 * código vira chave de i18n, e ele existe separado dos componentes porque a
 * ficha é lida em três lugares (Garagem, cadastro e Comunidade) e o editor usa
 * o mesmo vocabulário da leitura.
 *
 * Regra que vale para tudo aqui: chave que não existir nos TRÊS idiomas
 * aparece crua na tela. Nada de `t(code)` montado na mão — as chaves são
 * literais previsíveis, prefixadas, e todas nascem em `i18n.js` de uma vez.
 */

import { SPEC_STATUS } from "../../services/vehicleSpecs";

/** Campos cujo valor é um enum, e o prefixo da chave de cada um. */
const ENUM_FIELDS = new Set([
  "aspiration",
  "fuel",
  "transmission",
  "drivetrain",
  "bodyStyle",
]);

export const fieldLabel = (t, id) => t(`specSheet.field.${id}`);

export const holdLabel = (t, reason) => t(`specSheet.hold.${reason}`);

export const absentLabel = (t, reason) => t(`specSheet.absent.${reason}`);

export const originLabel = (t, tag) => t(`specSheet.origin.${tag}`);

export const modLabel = (t, id) => t(`specSheet.mod.${id}`);

export const stageLabel = (t, id) => t(`specSheet.stage.${id}`);

export const issueLabel = (t, issue) =>
  t(`specSheet.issue.${issue.code}`, {
    ...issue.data,
    field: issue.field ? fieldLabel(t, issue.field) : "",
  });

/**
 * Número no formato do idioma da pessoa. `pt-BR` escreve 15,6 e `en-US`
 * escreve 15.6 — publicar o separador errado num painel técnico é o tipo de
 * detalhe que faz a ficha parecer importada.
 */
export const formatNumber = (language, value, decimals = 0) =>
  new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value) || 0);

const DECIMALS = { torque: 1, accel0to100S: 1 };

export const decimalsFor = (id) => DECIMALS[id] ?? 0;

/**
 * O valor de uma célula como texto pronto.
 *
 * Devolve `null` quando não há valor — quem chama decide o que desenhar no
 * lugar, e o que NÃO se desenha nunca é um traço nem um zero.
 */
export const cellText = (t, language, cell) => {
  if (!cell || cell.status !== SPEC_STATUS.VALUE) return null;

  if (ENUM_FIELDS.has(cell.id)) {
    return t(`specSheet.value.${cell.id}.${cell.value}`, {
      defaultValue: String(cell.value),
    });
  }

  if (cell.id === "engineFamily") return cell.value ? String(cell.value) : null;

  if (cell.id === "doors") return t("specSheet.doorsCount", { count: cell.value });

  // Cilindrada e válvulas não são medição, são designação: o carro se chama
  // "1.0 12V" com ponto em qualquer idioma, do mesmo jeito que a FIPE escreve.
  // Passar pelo Intl transformaria em "1,0 L" em pt-BR e em "1 L" por
  // arredondamento — dois jeitos de errar o nome do próprio motor.
  if (cell.id === "displacement") return Number(cell.value).toFixed(1);

  if (cell.id === "valves") return `${cell.value}V`;

  if (cell.value === null || cell.value === undefined) return null;

  const number = formatNumber(language, cell.value, decimalsFor(cell.id));
  return cell.unit ? `${number} ${cell.unit}` : number;
};

/** Os dois lados do par flex, já formatados, ou `null` quando não é par. */
export const cellPair = (language, cell) => {
  if (!cell?.pair) return null;
  const decimals = decimalsFor(cell.id);
  return {
    ethanol: formatNumber(language, cell.pair.ethanol, decimals),
    gasoline: formatNumber(language, cell.pair.gasoline, decimals),
    unit: cell.unit || "",
  };
};

/** Um único combustível declarado ("no etanol"), quando não há par. */
export const fuelBasisLabel = (t, cell) =>
  cell?.fuelBasis ? t(`specSheet.fuelBasis.${cell.fuelBasis}`) : "";

/**
 * A régua em que o número foi medido. Só existe para potência e torque, e só
 * aparece quando é `wheel`: "no motor" é o padrão de toda ficha de fábrica, e
 * repetir o padrão em cada célula seria ruído. O que precisa de aviso é a
 * exceção.
 */
export const basisLabel = (t, cell) =>
  cell?.basis ? t(`specSheet.basis.${cell.basis}`) : "";

/** A linha de resumo do CarCard: só o que o parser garante, sem desculpa. */
export const summaryTokens = (t, language, resolved) => {
  const wanted = ["displacement", "fuel", "transmission", "powerCv"];
  return wanted
    .map((id) => {
      const cell = resolved.fields[id];
      if (!cell || cell.status !== SPEC_STATUS.VALUE) return null;
      if (id === "powerCv") {
        // No card cabe um número só: o maior do par. A ficha mostra os dois.
        const value = cell.pair ? Math.max(cell.pair.ethanol, cell.pair.gasoline) : cell.value;
        return `${formatNumber(language, value, 0)} ${cell.unit || "cv"}`;
      }
      return cellText(t, language, cell);
    })
    .filter(Boolean);
};
