/**
 * Chave de junção entre a string de versão da FIPE e a tabela do PBE Veicular.
 *
 * Existe como módulo próprio por um motivo específico: quem GERA a base
 * (`scripts/fetch-inmetro-consumption.mjs`) e quem CONSULTA a base
 * (`services/consumption.js`) têm que usar exatamente a mesma regra. Base
 * gerada com uma chave e lida com outra não dá erro — dá silêncio, e o
 * simulador cai no padrão sem ninguém perceber que perdeu a medição.
 *
 * O problema que a chave resolve: a FIPE identifica carro por uma string só
 * (`ONIX HATCH LTZ 1.0 12V TB Flex 5p Aut.`) e o INMETRO por campos separados
 * (`CHEVROLET` / `ONIX` / `LTZ` / `1.0T - 12V`). O que os une é marca + nome
 * comercial + cilindrada + sobrealimentação, e os dois lados têm isso — o
 * lado da FIPE via `fipeVersion.js`, que extrai cilindrada e aspiração da
 * string com confiança medida.
 */

/** Tokens alfanuméricos, sem acento: `1.0T - 12V` -> ["10T","12V"]. */
export const tokenize = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

/**
 * Palavras que a FIPE põe ANTES do nome do modelo. Sem tirar, `Nova Ranger`
 * não começa por `RANGER` e a picape inteira fica de fora.
 */
const LEADING_NOISE = new Set(["NOVO", "NOVA", "NEW", "ALL"]);

const modelTokens = (text) => {
  const tokens = tokenize(text);
  return tokens.length > 1 && LEADING_NOISE.has(tokens[0]) ? tokens.slice(1) : tokens;
};

export const brandKey = (brand) => tokenize(brand).join(" ");
export const nameKey = (model) => modelTokens(model).join(" ");

export const modelKey = (brand, model) => `${brandKey(brand)}|${nameKey(model)}`;

export const versionKey = (brand, model, displacement, mark) =>
  `${modelKey(brand, model)}|${displacement.toFixed(1)}|${mark}`;

/**
 * Marcador de aspiração da chave.
 *
 * Em motor a gasolina ou flex a aspiração discrimina de verdade: a FIPE lista
 * o Polo 1.0 MPI e o Polo 1.0 TSI, e são consumos diferentes.
 *
 * Em diesel ela não discrimina nada. Veículo leve a diesel no Brasil é turbo
 * há décadas, e o campo `Motor` do INMETRO não escreve o T — o Amarok 2.0 TDI
 * aparece lá como "2.0-16V". Manter aspiração na chave aí não separava dois
 * motores, só derrubava o casamento de toda picape e todo SUV a diesel.
 */
export const aspirationMark = (isDiesel, isTurbo, isHybrid) => {
  // Híbrido é o primeiro teste, e o motivo é o pior erro que esta base pode
  // cometer. Na tabela 2026 o Civic é só e:HEV: `HONDA|CIVIC|2.0` mede 17,2
  // km/l. Um `Civic Sedan EXL 2.0 Flex` de 2016, que faz uns 10, cairia nessa
  // chave e teria a conta de combustível cortada em 40%. Trocar assinatura de
  // motor entre híbrido e não-híbrido é trocar de carro.
  if (isHybrid) return "h";
  if (isDiesel) return "d";
  return isTurbo ? "t" : "n";
};

/**
 * Índice de nomes comerciais por marca, para resolver o nome pela PRÓPRIA
 * tabela em vez de por um dicionário paralelo.
 *
 * O nome do modelo é reconhecido quando os tokens do nome do INMETRO são
 * prefixo dos tokens da string da FIPE. `ONIX HATCH LTZ 1.0` casa com `ONIX`;
 * `ONIX PLUS LTZ 1.0` casa com `ONIX PLUS`, que é testado antes por ser mais
 * longo. Comparar por token e não por texto corrido é o que impede o `M2` da
 * BMW de casar com um `M240i`.
 */
export function buildNameIndex(modelKeys) {
  const index = new Map();
  for (const key of modelKeys) {
    const [brand, name] = key.split("|");
    if (!index.has(brand)) index.set(brand, []);
    index.get(brand).push(name);
  }
  for (const names of index.values()) {
    names.sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);
  }
  return index;
}

/** Nome comercial da tabela que corresponde a esta string da FIPE, ou null. */
export function resolveName(index, brand, fipeModel) {
  const names = index.get(brandKey(brand));
  if (!names) return null;
  const tokens = modelTokens(fipeModel);
  if (!tokens.length) return null;
  return (
    names.find((name) => {
      const wanted = name.split(" ");
      return wanted.every((token, i) => tokens[i] === token);
    }) || null
  );
}
