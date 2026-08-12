// Motor de "custo real de posse" (TCO) do Engine.
//
// Estima quanto custa POR MÊS comprar e manter um veículo e quanto de renda
// mensal o usuário precisa para isso, combinando:
//   - IPVA/licenciamento por UF (Brasil, tabela 2026) ou imposto de circulação
//     equivalente por país;
//   - seguro estimado por faixa etária do condutor (referência SUSEP: jovens de
//     18-25 pagam ~9,5% do valor do carro/ano; 56+ pagam ~4,4%), região,
//     garagem e tipo de cobertura;
//   - combustível (médias ANP jul/2026, ajustadas por UF) × consumo × km/mês;
//   - manutenção preventiva/corretiva por idade do carro e rodagem;
//   - financiamento (tabela Price) com entrada, prazo e juros médios de mercado;
//   - depreciação (custo "invisível", informativo);
//   - regra de comprometimento de renda (padrão: custo total ≤ 20% da renda).
//
// Todos os valores são ESTIMATIVAS de planejamento, não cotações.

// ---------------------------------------------------------------------------
// Brasil — dados por UF
// ---------------------------------------------------------------------------

// Alíquota de IPVA para automóveis de passeio (2026).
const IPVA_BR = {
  AC: 0.02, AL: 0.0325, AP: 0.03, AM: 0.03, BA: 0.025, CE: 0.031, DF: 0.035,
  ES: 0.02, GO: 0.0375, MA: 0.025, MT: 0.0345, MS: 0.03, MG: 0.04, PA: 0.025,
  PB: 0.025, PR: 0.019, PE: 0.03, PI: 0.025, RJ: 0.04, RN: 0.03, RS: 0.03,
  RO: 0.03, RR: 0.03, SC: 0.02, SP: 0.04, SE: 0.025, TO: 0.02,
};
const IPVA_BR_DEFAULT = 0.03;

// Taxa anual de licenciamento (CRLV) aproximada por UF, em BRL.
const LICENSING_BR = {
  SP: 167, MG: 161, RJ: 231, RS: 98, PR: 107, SC: 138, ES: 127, BA: 132,
  PE: 122, CE: 127, DF: 145, GO: 128, MT: 150, MS: 140, PA: 120, MA: 110,
  PB: 115, PI: 110, RN: 118, AL: 115, SE: 112, AM: 130, AC: 120, AP: 115,
  RO: 125, RR: 115, TO: 118,
};
const LICENSING_BR_DEFAULT = 140;

// Fator de preço de combustível por UF sobre a média nacional (frete/ICMS).
const FUEL_FACTOR_BR = {
  SP: 0.97, PR: 0.96, SC: 0.98, MG: 0.99, RJ: 1.03, ES: 1.0, RS: 1.02,
  DF: 1.0, GO: 0.98, MT: 0.97, MS: 0.96, BA: 1.02, PE: 1.02, CE: 1.03,
  MA: 1.03, PI: 1.04, PB: 1.03, RN: 1.03, AL: 1.03, SE: 1.02, PA: 1.06,
  AM: 1.06, AC: 1.15, RO: 1.07, RR: 1.08, AP: 1.08, TO: 1.04,
};

// Fator regional de risco do seguro (roubo/furto/sinistralidade).
const INSURANCE_REGION_BR = {
  RJ: 1.3, SP: 1.15, PE: 1.12, RS: 1.1, BA: 1.08, DF: 1.05, AM: 1.05,
  CE: 1.05, PA: 1.05, GO: 1.02, MG: 1.0, PR: 1.0, ES: 1.0, SC: 0.92,
};

// Preços médios de combustível no Brasil (ANP, jul/2026), BRL por litro/kWh.
const FUEL_PRICE_BR = {
  gasoline: 6.61,
  ethanol: 4.49,
  diesel: 6.3,
  electric: 0.85, // BRL por kWh (tarifa residencial média com impostos)
};

// ---------------------------------------------------------------------------
// Outros países — perfis genéricos (estimativas convertidas para BRL)
// ---------------------------------------------------------------------------
// taxPct: imposto anual de circulação/propriedade como % do valor do veículo.
// registrationFlat: taxa anual fixa de registro/vistoria (BRL).
// insuranceFactor: multiplicador sobre a curva etária brasileira.
// maintenanceFactor: custo de mão de obra/peças relativo ao Brasil.
// fuelPrice: BRL/L equivalente (gasolina); electric em BRL/kWh.
// monthlyRate: juros médios de financiamento ao mês.
const COUNTRY_PROFILES = {
  BR: { taxPct: null, registrationFlat: null, insuranceFactor: 1, maintenanceFactor: 1, fuelPrice: FUEL_PRICE_BR, monthlyRate: 0.0199 },
  PT: { taxPct: 0.006, registrationFlat: 250, insuranceFactor: 0.55, maintenanceFactor: 1.25, fuelPrice: { gasoline: 10.5, ethanol: 10.5, diesel: 9.6, electric: 1.4 }, monthlyRate: 0.006 },
  US: { taxPct: 0.01, registrationFlat: 400, insuranceFactor: 1.1, maintenanceFactor: 1.3, fuelPrice: { gasoline: 4.8, ethanol: 4.2, diesel: 5.2, electric: 0.9 }, monthlyRate: 0.0065 },
  ES: { taxPct: 0.005, registrationFlat: 300, insuranceFactor: 0.5, maintenanceFactor: 1.2, fuelPrice: { gasoline: 9.3, ethanol: 9.3, diesel: 8.7, electric: 1.5 }, monthlyRate: 0.0065 },
  AR: { taxPct: 0.035, registrationFlat: 200, insuranceFactor: 1.0, maintenanceFactor: 0.9, fuelPrice: { gasoline: 6.5, ethanol: 6.0, diesel: 6.8, electric: 0.6 }, monthlyRate: 0.04 },
  MX: { taxPct: 0.003, registrationFlat: 220, insuranceFactor: 0.7, maintenanceFactor: 0.9, fuelPrice: { gasoline: 6.7, ethanol: 6.7, diesel: 7.0, electric: 0.7 }, monthlyRate: 0.0115 },
  CL: { taxPct: 0.015, registrationFlat: 180, insuranceFactor: 0.7, maintenanceFactor: 1.0, fuelPrice: { gasoline: 7.5, ethanol: 7.5, diesel: 6.9, electric: 1.0 }, monthlyRate: 0.01 },
  CO: { taxPct: 0.015, registrationFlat: 160, insuranceFactor: 0.8, maintenanceFactor: 0.85, fuelPrice: { gasoline: 4.5, ethanol: 4.5, diesel: 4.2, electric: 0.6 }, monthlyRate: 0.015 },
  GB: { taxPct: 0.004, registrationFlat: 1300, insuranceFactor: 1.0, maintenanceFactor: 1.35, fuelPrice: { gasoline: 10.3, ethanol: 10.3, diesel: 10.7, electric: 1.8 }, monthlyRate: 0.0075 },
  FR: { taxPct: 0.001, registrationFlat: 250, insuranceFactor: 0.6, maintenanceFactor: 1.3, fuelPrice: { gasoline: 11.1, ethanol: 7.2, diesel: 10.6, electric: 1.4 }, monthlyRate: 0.005 },
  DE: { taxPct: 0.004, registrationFlat: 300, insuranceFactor: 0.7, maintenanceFactor: 1.35, fuelPrice: { gasoline: 10.5, ethanol: 9.0, diesel: 9.9, electric: 2.2 }, monthlyRate: 0.005 },
  IT: { taxPct: 0.006, registrationFlat: 280, insuranceFactor: 0.85, maintenanceFactor: 1.25, fuelPrice: { gasoline: 10.8, ethanol: 10.8, diesel: 10.3, electric: 1.7 }, monthlyRate: 0.006 },
};

// ---------------------------------------------------------------------------
// Curvas de risco/uso
// ---------------------------------------------------------------------------

// % do valor do carro por ano em seguro completo, por faixa etária (SUSEP).
const INSURANCE_AGE_RATES = {
  "18-25": 0.095,
  "26-35": 0.065,
  "36-55": 0.055,
  "56+": 0.045,
};

const USAGE_INSURANCE_FACTOR = { personal: 1, commute: 1.08, app: 1.35 };

// Consumo padrão por combustível (km por litro; elétrico em km por kWh).
export const DEFAULT_CONSUMPTION = {
  gasoline: 11.5,
  ethanol: 8,
  diesel: 12.5,
  electric: 6,
};

// Situação de vida do usuário: define quanto da renda é saudável comprometer
// com o carro. Quem mora com os pais (quase sem contas fixas) pode ir mais
// longe; quem banca a casa inteira precisa de folga maior no orçamento.
export const LIFE_SITUATIONS = {
  with_family: { suggestedShare: 35, comfortable: 0.35, warning: 0.45 },
  shared: { suggestedShare: 20, comfortable: 0.2, warning: 0.3 },
  independent: { suggestedShare: 15, comfortable: 0.15, warning: 0.25 },
};

export const FUEL_TYPES = ["gasoline", "ethanol", "diesel", "electric"];
export const AGE_BANDS = Object.keys(INSURANCE_AGE_RATES);
export const COVERAGE_TYPES = ["full", "thirdparty", "none"];
export const USAGE_TYPES = Object.keys(USAGE_INSURANCE_FACTOR);
export const LIFE_SITUATION_TYPES = Object.keys(LIFE_SITUATIONS);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Extrai o ano-modelo do texto da FIPE ("2018 Gasolina", "32000" = zero km).
//
// As bordas de palavra são essenciais: sem elas o rótulo de zero km da FIPE,
// "32000", casava o "2000" no meio e o carro novo virava um carro de 26 anos —
// com depreciação quatro vezes menor, que é justamente o número que mais pesa
// para quem compra zero km. Sem casamento, o ano é o corrente, que é o certo
// tanto para o zero km quanto para um rótulo que não reconhecemos.
const parseCarYear = (yearLabel) => {
  const current = new Date().getFullYear();
  const match = String(yearLabel || "").match(/\b(19|20)\d{2}\b/);
  if (!match) return current;
  const year = Number(match[0]);
  return year > current + 1 ? current : year;
};

export const defaultOwnershipInputs = () => ({
  kmPerMonth: 1000,
  fuelType: "gasoline",
  consumption: 0, // 0 = usar padrão do combustível
  userConsumption: 0, // 0 = não informado, usar automático ou default
  driverAgeBand: "18-25",
  hasGarage: true,
  coverage: "full",
  usage: "personal",
  purchaseMode: "finance",
  downPaymentValue: 0, // 0 = usar savedValue do carro
  financeMonths: 48,
  monthlyRatePct: 0, // 0 = usar taxa média do país
  lifeSituation: "shared",
  incomeSharePct: 20,
  monthlyIncome: 0,
  parkingMonthly: 0,
  tollsMonthly: 0,
});

export const normalizeOwnershipInputs = (raw = {}) => {
  const base = defaultOwnershipInputs();
  return {
    kmPerMonth: clamp(num(raw.kmPerMonth, base.kmPerMonth), 100, 20000),
    fuelType: FUEL_TYPES.includes(raw.fuelType) ? raw.fuelType : base.fuelType,
    consumption: clamp(num(raw.consumption, 0), 0, 50),
    userConsumption: clamp(num(raw.userConsumption, 0), 0, 50), // Consumo informado pelo user
    driverAgeBand: AGE_BANDS.includes(raw.driverAgeBand)
      ? raw.driverAgeBand
      : base.driverAgeBand,
    hasGarage: raw.hasGarage !== false,
    coverage: COVERAGE_TYPES.includes(raw.coverage) ? raw.coverage : base.coverage,
    usage: USAGE_TYPES.includes(raw.usage) ? raw.usage : base.usage,
    purchaseMode: raw.purchaseMode === "cash" ? "cash" : "finance",
    downPaymentValue: clamp(num(raw.downPaymentValue, 0), 0, 100000000),
    financeMonths: clamp(Math.round(num(raw.financeMonths, base.financeMonths)), 6, 72),
    monthlyRatePct: clamp(num(raw.monthlyRatePct, 0), 0, 15),
    lifeSituation: LIFE_SITUATION_TYPES.includes(raw.lifeSituation)
      ? raw.lifeSituation
      : base.lifeSituation,
    incomeSharePct: clamp(
      Math.round(num(raw.incomeSharePct, base.incomeSharePct)),
      5,
      60,
    ),
    monthlyIncome: clamp(num(raw.monthlyIncome, 0), 0, 100000000),
    parkingMonthly: clamp(num(raw.parkingMonthly, 0), 0, 1000000),
    tollsMonthly: clamp(num(raw.tollsMonthly, 0), 0, 1000000),
  };
};

const countryProfile = (country) => COUNTRY_PROFILES[country] || COUNTRY_PROFILES.BR;

// ---------------------------------------------------------------------------
// Blocos de cálculo
// ---------------------------------------------------------------------------

const annualVehicleTax = (value, country, state) => {
  if (country === "BR") {
    return value * (IPVA_BR[state] || IPVA_BR_DEFAULT);
  }
  const profile = countryProfile(country);
  return value * (profile.taxPct || 0);
};

const annualLicensing = (country, state) => {
  if (country === "BR") return LICENSING_BR[state] || LICENSING_BR_DEFAULT;
  return countryProfile(country).registrationFlat || 0;
};

const annualInsurance = (value, carAge, inputs, country, state) => {
  if (inputs.coverage === "none") return 0;

  const countryFactor = countryProfile(country).insuranceFactor;

  if (inputs.coverage === "thirdparty") {
    // Cobertura só contra terceiros: pouco sensível ao valor do carro, mas
    // muito sensível a quem dirige — responsabilidade civil é risco do
    // condutor, não do veículo. Ignorar a idade fazia um motorista de 19 anos
    // e um de 60 pagarem exatamente o mesmo.
    //
    // O fator sai da própria curva etária, normalizada pela faixa do meio,
    // e é achatado pela raiz porque o prêmio de terceiros varia menos que o
    // de casco. É um default grosseiro assumido: não conheço fonte que
    // publique curva etária de RCF isolada.
    const ageRatio = INSURANCE_AGE_RATES[inputs.driverAgeBand] / INSURANCE_AGE_RATES["36-55"];
    const ageFactor = clamp(Math.sqrt(ageRatio), 0.85, 1.35);
    return clamp(value * 0.015, 700, 2200) * ageFactor * countryFactor;
  }

  const ageRate = INSURANCE_AGE_RATES[inputs.driverAgeBand];
  const regionFactor =
    country === "BR" ? INSURANCE_REGION_BR[state] || 1 : 1;
  const garageFactor = inputs.hasGarage ? 0.88 : 1.12;
  const usageFactor = USAGE_INSURANCE_FACTOR[inputs.usage];
  const carAgeFactor = carAge > 10 ? 0.85 : 1;

  const annual =
    value * ageRate * regionFactor * garageFactor * usageFactor * carAgeFactor *
    countryFactor;
  // Os limites são de mercado brasileiro e precisam acompanhar o fator do
  // país: aplicados crus, o piso de 2,5% reintroduzia em Portugal e Espanha um
  // seguro 15–26% mais caro do que o próprio modelo acabara de dizer que era.
  return clamp(annual, value * 0.025 * countryFactor, value * 0.16 * countryFactor);
};

const monthlyFuel = (inputs, country, state) => {
  const prices = countryProfile(country).fuelPrice;
  const basePrice = prices[inputs.fuelType] || prices.gasoline;
  // O fator por UF é de frete e ICMS de combustível líquido; energia elétrica
  // tem outra formação de preço. Aplicá-lo ao elétrico cobrava 18% a mais de
  // um carro no Acre por um motivo que não existe na conta de luz.
  const stateFactor =
    country === "BR" && inputs.fuelType !== "electric"
      ? FUEL_FACTOR_BR[state] || 1
      : 1;

  // Hierarquia: user informado > consumption > default
  let consumption = DEFAULT_CONSUMPTION[inputs.fuelType];
  if (inputs.consumption > 0) {
    consumption = inputs.consumption;
  }
  if (inputs.userConsumption > 0) {
    consumption = inputs.userConsumption; // User sempre sobrescreve
  }

  return (inputs.kmPerMonth / consumption) * basePrice * stateFactor;
};

const annualMaintenance = (value, carAge, inputs, country) => {
  // Cobre revisões, óleo, pneus, freios e uma margem para corretivas.
  // Alinhado com AAA 2025: carros novos (0-3 anos) custam menos, aumenta gradualmente.
  const agePct = carAge <= 3 ? 0.015 : carAge <= 8 ? 0.025 : 0.04;
  const kmFactor = clamp(0.7 + 0.3 * (inputs.kmPerMonth / 1000), 0.7, 2.2);
  const base = Math.max(value * agePct, 1200);
  return base * kmFactor * countryProfile(country).maintenanceFactor;
};

// Curva realista: 1º ano máximo (contrato + transferência), desacelera depois.
// Baseado em Edmunds TCO e dados reais de mercado (2024-2026).
const annualDepreciationRate = (carAge) => {
  if (carAge <= 1) return 0.16; // 1º ano: contrato + uso inicial (máximo)
  if (carAge <= 2) return 0.12; // 2º ano: desaceleração
  if (carAge <= 3) return 0.10;
  if (carAge <= 5) return 0.08;
  if (carAge <= 8) return 0.06;
  return 0.04; // 8+ anos: estabiliza
};

// Parcela pela tabela Price.
const priceInstallment = (principal, monthlyRate, months) => {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, -months);
  return (principal * monthlyRate) / (1 - factor);
};

// ---------------------------------------------------------------------------
// Estimativa completa
// ---------------------------------------------------------------------------

export function estimateOwnership(car, rawInputs = {}, location = {}) {
  const inputs = normalizeOwnershipInputs(rawInputs);
  const country = String(location.country || "BR").toUpperCase();
  const state = String(location.state || "").toUpperCase();
  const value = Math.max(num(car?.targetValue, 0), 0);
  const savedValue = Math.max(num(car?.savedValue, 0), 0);
  const carAge = Math.max(new Date().getFullYear() - parseCarYear(car?.year), 0);

  // --- Compra / financiamento -------------------------------------------
  const recommendedDownPayment = value * 0.25; // 20–30% é a faixa saudável
  let financing = null;
  if (inputs.purchaseMode === "finance" && value > 0) {
    const downPayment = clamp(
      inputs.downPaymentValue > 0 ? inputs.downPaymentValue : savedValue,
      0,
      value,
    );
    const principal = value - downPayment;
    const monthlyRate =
      inputs.monthlyRatePct > 0
        ? inputs.monthlyRatePct / 100
        : countryProfile(country).monthlyRate;
    const installment = priceInstallment(principal, monthlyRate, inputs.financeMonths);
    financing = {
      downPayment,
      downPaymentPct: value > 0 ? downPayment / value : 0,
      principal,
      months: inputs.financeMonths,
      monthlyRate,
      installment,
      totalPaid: downPayment + installment * inputs.financeMonths,
      totalInterest: installment * inputs.financeMonths - principal,
    };
  }

  // --- Custos mensais de manutenção da posse ----------------------------
  const tax = annualVehicleTax(value, country, state);
  const licensing = annualLicensing(country, state);
  const insurance = annualInsurance(value, carAge, inputs, country, state);
  const fuel = monthlyFuel(inputs, country, state);
  const maintenance = annualMaintenance(value, carAge, inputs, country);
  const depreciation = (value * annualDepreciationRate(carAge)) / 12;

  const monthly = {
    financing: financing ? financing.installment : 0,
    tax: tax / 12,
    licensing: licensing / 12,
    insurance: insurance / 12,
    fuel,
    maintenance: maintenance / 12,
    parking: inputs.parkingMonthly,
    tolls: inputs.tollsMonthly,
    depreciation,
  };

  const monthlyMaintain =
    monthly.tax +
    monthly.licensing +
    monthly.insurance +
    monthly.fuel +
    monthly.maintenance +
    monthly.parking +
    monthly.tolls;
  const monthlyTotal = monthlyMaintain + monthly.financing;

  // --- Recomendações ----------------------------------------------------
  const share = inputs.incomeSharePct / 100;
  const requiredIncomeTotal = monthlyTotal / share;
  const requiredIncomeMaintain = monthlyMaintain / share;
  const emergencyFund = Math.max(monthlyMaintain * 3, value * 0.02);

  // Limites de conforto adaptados à situação de vida: quem mora com os pais
  // pode comprometer mais da renda do que quem sustenta a casa sozinho.
  const situation = LIFE_SITUATIONS[inputs.lifeSituation];
  let comfortLevel = null;
  let committedPct = null;
  if (inputs.monthlyIncome > 0) {
    committedPct = monthlyTotal / inputs.monthlyIncome;
    comfortLevel =
      committedPct <= situation.comfortable
        ? "comfortable"
        : committedPct <= situation.warning
          ? "warning"
          : "critical";
  }

  return {
    inputs,
    country,
    state,
    value,
    carAge,
    monthly,
    totals: {
      monthlyMaintain,
      monthlyTotal,
      annualMaintain: monthlyMaintain * 12,
      annualTotal: monthlyTotal * 12,
    },
    financing,
    recommendations: {
      requiredIncomeTotal,
      requiredIncomeMaintain,
      recommendedDownPayment,
      recommendedDownPaymentPct: 0.25,
      emergencyFund,
      incomeSharePct: inputs.incomeSharePct,
      suggestedSharePct: situation.suggestedShare,
      comfortThresholds: {
        comfortable: situation.comfortable,
        warning: situation.warning,
      },
      committedPct,
      comfortLevel,
      downPaymentGap: Math.max(recommendedDownPayment - savedValue, 0),
    },
  };
}
