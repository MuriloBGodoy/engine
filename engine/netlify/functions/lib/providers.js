/**
 * Qual gateway atende cada região.
 *
 * O Engine já trata região como conceito de primeira classe (o filtro de
 * serviços mostra o que existe perto de quem olha); pagamento segue a mesma
 * ideia, porque nenhum provedor cobre bem os 12 países suportados:
 *
 *  - Mercado Pago tem Pix e é o checkout que o vendedor da LatAm reconhece,
 *    mas não opera em Portugal, EUA nem na Europa.
 *  - Stripe cobre EUA e Europa, mas no Brasil fica só no cartão (Pix é
 *    invite-only para empresas brasileiras) e a marca não diz nada pro MEI.
 *
 * Quem paga é sempre o prestador, e prestador é local por natureza: lavagem de
 * carro em Araraquara não interessa a ninguém em Lisboa. Então o provedor sai
 * do país dele, não de uma escolha global.
 */
export const MERCADO_PAGO = "mercadopago";
export const STRIPE = "stripe";

// Países onde o Mercado Pago opera e que o Engine suporta (locations.js).
const MERCADO_PAGO_COUNTRIES = ["BR", "AR", "MX", "CL", "CO"];

/** Preço mensal do plano por moeda, na menor unidade quando o provedor pede. */
export const PLAN_PRICES = {
  BRL: 25,
  USD: 6,
  EUR: 6,
};

const COUNTRY_CURRENCY = {
  BR: "BRL",
  AR: "USD",
  MX: "USD",
  CL: "USD",
  CO: "USD",
  US: "USD",
  PT: "EUR",
  ES: "EUR",
  GB: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
};

export function providerForCountry(country) {
  const code = String(country || "").toUpperCase();
  return MERCADO_PAGO_COUNTRIES.includes(code) ? MERCADO_PAGO : STRIPE;
}

export function currencyForCountry(country) {
  return COUNTRY_CURRENCY[String(country || "").toUpperCase()] || "USD";
}
