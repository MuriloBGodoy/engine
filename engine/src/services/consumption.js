// Consumo medido do PBE Veicular (INMETRO/CONPET), tabela 2026.
//
// FONTE: https://dados.inmetro.gov.br/programa_brasileiro_de_etiquetagem/VEICULOS_2026.csv
// Baixada em 18/08/2026 por `npm run fetch:consumption`. CSV público, sem
// chave. 839 registros, 44 marcas. O arquivo derivado é
// `src/data/inmetro-consumption.json` e declara fonte, URL e data.
//
// Isto substitui a base anterior, que se dizia "consumo real INMETRO" e não
// era: 91 modelos com 24 tuplas distintas e valor de diesel em Gol, Uno e
// Kwid. Agora é medição de laboratório (NBR 7024) já ajustada pelo próprio
// INMETRO para uso real — Portaria Inmetro 169/2023 —, e a metodologia
// publicada declara que 90% dos motoristas ficam a ±20% do valor da tabela.
// Esse ±20% é exatamente a banda que `estimateOwnershipRange` já abria por
// conta própria, e agora ela tem fonte.
//
// TRÊS COISAS QUE ESTA BASE NÃO É, e que a tela precisa continuar dizendo:
//
// 1. NÃO cobre carro descontinuado. A tabela é de veículo novo. Medido contra
//    4.864 versões reais da FIPE (19 marcas), casa 33,1%: 12,5% no nível de
//    versão e 20,7% no nível de modelo. O resto é Gol, Palio, Corsa, Ka —
//    carro que saiu de linha e nunca esteve numa tabela de 2026. Para eles
//    `consumptionFor` devolve null e o simulador cai no padrão por
//    combustível, que é a resposta honesta: "não sei o deste carro".
// 2. NÃO cobre elétrico. O PBE publica km por "litro equivalente" e não
//    declara a equivalência em kWh; a que sai do próprio arquivo (~5,6 kWh por
//    litro equivalente) não é a da EPA (8,9). Converter com o fator errado
//    erraria a energia em ~60%, então elétrico fica de fora.
// 3. NÃO é o consumo DESTE carro. É o da versão nova equivalente, num ciclo
//    padronizado. O consumo real do carro da pessoa quem calcula é o
//    `expenses.js`, a partir dos abastecimentos dela — e esse ganha de
//    qualquer tabela.
// `with { type: "json" }` não é enfeite: sem isso o módulo importa no Vite mas
// explode no Node, e é em Node que os cenários do simulador são conferidos.
import table from "../data/inmetro-consumption.json" with { type: "json" };
import { parseFipeVersion, ASPIRATION } from "./fipeVersion.js";
import {
  aspirationMark,
  buildNameIndex,
  modelKey,
  resolveName,
} from "./consumptionKey.js";

export const INMETRO_TABLE_YEAR = table.tableYear;
export const INMETRO_SOURCE_URL = table.sourceUrl;
/** Peso do ciclo urbano no combinado, derivado da própria tabela. Ver o script. */
export const INMETRO_CITY_WEIGHT = table.cityWeight;

/**
 * A partir de quantos anos de diferença o número da tabela vira aproximação
 * declarada em vez de medição do carro.
 *
 * Não é palpite: comparei a tabela 2021 com a 2026 nas 43 versões que
 * sobreviveram com mesma marca, modelo, motor e câmbio. A mediana da razão de
 * km/l é 1,027 e 79% ficam dentro de ±10% — deriva menor que o ±20% que o
 * próprio INMETRO declara entre motoristas. Cinco anos é o intervalo que eu
 * medi; além dele eu não sei, e o rótulo passa a avisar.
 */
const DATED_AFTER_YEARS = 5;

/**
 * Índices montados uma vez, na carga do módulo.
 *
 * `nameIndex` resolve o nome comercial pela própria tabela. `engineIndex` diz,
 * para cada marca+nome+cilindrada, quais marcadores de aspiração existem — e é
 * o que permite abstrair a aspiração com segurança quando só existe um.
 */
const nameIndex = buildNameIndex(Object.keys(table.models));
const engineIndex = new Map();
for (const key of Object.keys(table.versions)) {
  const cut = key.lastIndexOf("|");
  const engine = key.slice(0, cut);
  const mark = key.slice(cut + 1);
  if (!engineIndex.has(engine)) engineIndex.set(engine, []);
  engineIndex.get(engine).push(mark);
}

/**
 * Consumo do carro em km/l por combustível, ou `null` quando a tabela não tem
 * este carro. Devolver `null` em vez de um padrão é de propósito: quem chama
 * precisa saber a diferença entre "medido para esta versão" e "média de
 * todos", senão a tela promete precisão que não tem.
 *
 * A resolução tem três degraus, e o terceiro é uma abstenção:
 *
 * 1. VERSÃO — marca, nome, cilindrada e aspiração batem. É o caso bom.
 * 2. VERSÃO COM ASPIRAÇÃO IGNORADA — quando a tabela só tem uma aspiração para
 *    aquele motor, a divergência não é informação, é anotação faltando. O
 *    campo `Motor` do INMETRO escreve "1.3-16V" para o Renegade T270, que é
 *    turbo, e "2.0-16V" para o Amarok TDI, que também é. Exigir o marcador dos
 *    dois lados derrubava o casamento sem separar motor nenhum.
 * 3. MODELO — só quando NÃO deu para ler a cilindrada da string da FIPE.
 *    Se a cilindrada foi lida e não existe na tabela, a resposta é `null`.
 *    Esse é o degrau que evita o pior erro possível aqui: um Strada 1.8 de
 *    2005 receber o consumo do Strada 1.3 de 2026 e a conta de combustível
 *    sair 40% barata demais. Motor que a tabela não tem é motor que a tabela
 *    não mediu.
 *
 * Recebe o carro inteiro, não só o nome: marca e ano fazem parte da chave.
 *
 * @param {{brand?: string, model?: string, year?: string}} car
 * @returns {null | {
 *   gasoline?: number, ethanol?: number, diesel?: number,
 *   cityHighway?: [number, number],
 *   match: "version" | "model", dated: boolean, tableYear: number
 * }}
 */
export function consumptionFor(car) {
  if (!car || !car.model) return null;
  const parsed = parseFipeVersion(car);
  const brand = parsed.brand?.value;
  if (!brand) return null;

  const name = resolveName(nameIndex, brand, parsed.raw.model);
  if (!name) return null;

  const displacement = parsed.displacement?.value;
  const aspiration = parsed.aspiration?.value;
  const isDiesel = parsed.fuel?.value === "diesel";
  const isHybrid = parsed.fuel?.value === "hybrid" || parsed.fuel?.value === "plugin_hybrid";
  const isTurbo =
    aspiration === ASPIRATION.TURBO ||
    aspiration === ASPIRATION.BITURBO ||
    aspiration === ASPIRATION.SUPERCHARGED;

  let entry = null;
  let match = "model";

  if (displacement) {
    const engine = `${modelKey(brand, name)}|${displacement.toFixed(1)}`;
    const marks = engineIndex.get(engine);
    if (!marks) return null;

    const wanted =
      aspiration || isDiesel || isHybrid ? aspirationMark(isDiesel, isTurbo, isHybrid) : null;
    // "só existe um marcador, então aceita" vale entre turbo e aspirado, onde a
    // divergência é anotação faltando no INMETRO. NÃO vale para híbrido: ali a
    // divergência é o carro ser outro.
    const single = marks.length === 1 && marks[0] !== "h" && !isHybrid ? marks[0] : null;
    const mark = wanted && marks.includes(wanted) ? wanted : single;
    if (!mark) return null;

    entry = table.versions[`${engine}|${mark}`];
    match = "version";
  } else {
    entry = table.models[modelKey(brand, name)];
  }
  if (!entry) return null;

  const modelYear = parsed.modelYear?.value || null;
  const dated =
    !parsed.isZeroKm && !!modelYear && table.tableYear - modelYear > DATED_AFTER_YEARS;

  return {
    ...(entry.gasoline ? { gasoline: entry.gasoline } : {}),
    ...(entry.ethanol ? { ethanol: entry.ethanol } : {}),
    ...(entry.diesel ? { diesel: entry.diesel } : {}),
    ...(entry.gasolineCityHwy ? { cityHighway: entry.gasolineCityHwy } : {}),
    match,
    dated,
    tableYear: table.tableYear,
  };
}

/**
 * km/l para um combustível específico, ou `null`.
 *
 * Um carro só a gasolina na tabela não ganha número de etanol, e nenhum carro
 * ganha número de diesel por estar numa coluna que o INMETRO compartilha entre
 * gasolina e diesel. Era esse o defeito da base antiga.
 */
export function kmPerLiterFor(car, fuelType) {
  const entry = consumptionFor(car);
  const value = entry?.[fuelType];
  return value > 0 ? value : null;
}
