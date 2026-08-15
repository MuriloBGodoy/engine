// Consumo estimado por modelo, compilado em 31/07/2026.
//
// ATENÇÃO À PROCEDÊNCIA. Isto já foi rotulado aqui e na tela como "consumo real
// do INMETRO", e não é. Auditado em 14/08/2026, o próprio arquivo desmente:
//   - 91 modelos compartilham só 24 tuplas distintas de valores — Corolla,
//     Focus, T-Cross, C4 Cactus, 408, Captur, Yuan, H2 e um Mercedes C180 têm
//     exatamente o mesmo consumo;
//   - todo modelo tem valor de diesel, inclusive Gol, Uno, Palio, Kwid, Onix,
//     Mobi e Prius, que não existem em versão diesel no Brasil;
//   - o JSON não declara fonte nenhuma, só `compiledAt` e `coverage: 100%`.
// O SIMULADOR-FONTES.md §6 já registrava que o INMETRO só publica PDF, sem CSV
// nem API — consistente com esta base não ter vindo de lá.
//
// Continua valendo a pena usar: é estimativa POR CATEGORIA e ainda separa um
// Hilux de um Mobi, o que a média única não faz. Mas é estimativa, a tela diz
// isso, e trocar por medição real segue em aberto.
//
// A base já existia no backend Java, mas só o dev fala com o backend: em
// produção `VITE_API_URL` é vazio, `getConsumption` devolvia null e todo carro
// caía no consumo genérico sem avisar. São 8 KB para 91 modelos — cabe no
// bundle e passa a valer nos dois ambientes.
//
// O casamento de nome replica o do `ConsumptionDatabase.java`: exato primeiro,
// depois a primeira palavra do modelo. Um "Onix Hatch 1.0 12V" encontra "onix".
import db from "../data/fipe-consumption-db.json";

const MODELS = db.models || {};
export const CONSUMPTION_DEFAULT = db.default || {
  gasoline: 11.5,
  ethanol: 8,
  diesel: 12.5,
};
export const CONSUMPTION_COMPILED_AT = db.compiledAt || "";

/**
 * Consumo do modelo em km/l por combustível, ou `null` quando o modelo não
 * está na base. Devolver `null` em vez do padrão é de propósito: quem chama
 * precisa saber a diferença entre "medido para este carro" e "média de todos",
 * senão a tela promete precisão que não tem.
 */
export function consumptionFor(modelName) {
  if (!modelName) return null;
  const normalized = String(modelName).toLowerCase().trim();
  if (MODELS[normalized]) return MODELS[normalized];
  const firstWord = normalized.split(/\s+/)[0];
  if (firstWord && MODELS[firstWord]) return MODELS[firstWord];
  return null;
}

/** km/l para um combustível específico, ou `null`. Elétrico não está na base. */
export function kmPerLiterFor(modelName, fuelType) {
  const entry = consumptionFor(modelName);
  const value = entry?.[fuelType];
  return value > 0 ? value : null;
}
