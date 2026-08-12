// Gasto real do carro que a pessoa JÁ TEM.
//
// O `ownership.js` estima quanto CUSTARIA um carro — é projeção, usada uma vez
// para decidir a compra. Aqui é o oposto: o que saiu do bolso de verdade, no
// carro que está na garagem hoje. Um é sonho, o outro é extrato.
//
// Nada aqui inventa número: tudo sai do que a pessoa lançou. Quando não há
// histórico suficiente para uma conta ser honesta, a função devolve `null` e a
// tela mostra menos, em vez de mostrar errado.

/** Categorias de gasto, na ordem em que aparecem na tela. */
export const EXPENSE_CATEGORIES = [
  "fuel",
  "maintenance",
  "tires",
  "insurance",
  "tax",
  "cleaning",
  "parking",
  "fine",
  "other",
];

/**
 * Categorias que entram no custo recorrente de rodar.
 *
 * Multa fica de fora do "custo por km": é evento, não custo de posse, e
 * incluir contamina a média de quem tomou uma multa cara num mês.
 */
const RECURRING_CATEGORIES = EXPENSE_CATEGORIES.filter((key) => key !== "fine");

/** Teto de lançamentos guardados no documento do carro. */
export const MAX_EXPENSES = 300;

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Data de um lançamento como Date local, sem escorregar de fuso. */
const entryDate = (entry) => new Date(`${entry.date}T12:00:00`);

const DAY_MS = 86400000;

export const normalizeExpense = (raw = {}) => ({
  id: String(raw.id || crypto.randomUUID()),
  category: EXPENSE_CATEGORIES.includes(raw.category) ? raw.category : "other",
  amount: Math.max(num(raw.amount), 0),
  date: String(raw.date || todayISO()).slice(0, 10),
  // 0 significa "não informado" — não zero. Odômetro alimenta consumo real e
  // km rodado por mês; sem ele o lançamento ainda vale como despesa.
  odometer: Math.max(Math.round(num(raw.odometer)), 0),
  liters: Math.max(num(raw.liters), 0),
  note: String(raw.note || "").trim().slice(0, 120),
  createdAt: raw.createdAt || new Date().toISOString(),
});

export const normalizeExpenses = (list) =>
  Array.isArray(list)
    ? list
        .map(normalizeExpense)
        .filter((entry) => entry.amount > 0 && entry.date)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, MAX_EXPENSES)
    : [];

/**
 * Consumo real, pelo método tanque a tanque.
 *
 * Distância entre dois abastecimentos dividida pelos litros do segundo. Vale a
 * pena repetir por que é o segundo e não o primeiro: os litros que você põe
 * agora são os que repõem o que gastou desde a última parada.
 *
 * Precisa de dois abastecimentos com odômetro, e assume tanque cheio nos dois.
 */
export const realConsumption = (expenses = []) => {
  const fills = expenses
    .filter((entry) => entry.category === "fuel" && entry.odometer > 0 && entry.liters > 0)
    .sort((a, b) => a.odometer - b.odometer);

  if (fills.length < 2) return null;

  let distance = 0;
  let liters = 0;
  for (let index = 1; index < fills.length; index += 1) {
    const leg = fills[index].odometer - fills[index - 1].odometer;
    // Odômetro que não avançou (ou voltou) é digitação errada: ignora o trecho
    // em vez de estourar a média. O mesmo vale para salto absurdo.
    if (leg <= 0 || leg > 5000) continue;
    distance += leg;
    liters += fills[index].liters;
  }

  if (distance <= 0 || liters <= 0) return null;
  return { kmPerLiter: distance / liters, distance, liters, fills: fills.length };
};

/** Km rodado por mês, medido pelo odômetro — não estimado. */
export const realKmPerMonth = (expenses = []) => {
  const marks = expenses
    .filter((entry) => entry.odometer > 0)
    .sort((a, b) => a.odometer - b.odometer);

  if (marks.length < 2) return null;

  const first = marks[0];
  const last = marks[marks.length - 1];
  const km = last.odometer - first.odometer;
  const days = (entryDate(last) - entryDate(first)) / DAY_MS;

  // Menos de duas semanas entre a primeira e a última marca não dá média
  // mensal: multiplicar por 30 uma semana atípica gera número que engana.
  if (km <= 0 || days < 14) return null;
  return (km / days) * 30;
};

/**
 * Resumo do que foi gasto: total, por categoria e por mês.
 *
 * `monthlyAverage` só existe com pelo menos 30 dias de histórico, porque antes
 * disso "média mensal" é só o total com outro nome.
 */
export const summarizeExpenses = (expenses = []) => {
  if (!expenses.length) {
    return { total: 0, byCategory: [], byMonth: [], monthlyAverage: null, daysCovered: 0 };
  }

  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysCovered = Math.max((entryDate(last) - entryDate(first)) / DAY_MS, 0);

  const totals = new Map();
  const months = new Map();
  let total = 0;
  let recurring = 0;

  for (const entry of expenses) {
    total += entry.amount;
    if (RECURRING_CATEGORIES.includes(entry.category)) recurring += entry.amount;
    totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount);
    const month = entry.date.slice(0, 7);
    months.set(month, (months.get(month) || 0) + entry.amount);
  }

  const byCategory = [...totals.entries()]
    .map(([category, amount]) => ({ category, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = [...months.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const monthlyAverage =
    daysCovered >= 30 ? recurring / (daysCovered / 30) : null;

  return { total, byCategory, byMonth, monthlyAverage, daysCovered };
};

/**
 * Tudo o que a tela precisa saber sobre o gasto de um carro.
 *
 * Junta resumo, consumo real e custo por km numa chamada só — as três contas
 * dependem da mesma lista, e separar obrigaria cada tela a repetir a leitura.
 */
export const expenseInsights = (car = {}) => {
  const expenses = normalizeExpenses(car.expenses);
  const summary = summarizeExpenses(expenses);
  const consumption = realConsumption(expenses);
  const kmPerMonth = realKmPerMonth(expenses);

  const costPerKm =
    summary.monthlyAverage && kmPerMonth ? summary.monthlyAverage / kmPerMonth : null;

  return { expenses, ...summary, consumption, kmPerMonth, costPerKm };
};

/**
 * Escolhe o carro que serve de referência real para uma simulação.
 *
 * Simular o Golf sozinho responde "quanto custaria". Comparar com o Jetta que
 * já está na garagem responde "quanto a mais que hoje" — que é a pergunta que
 * a pessoa realmente tem.
 *
 * Prefere o próprio carro quando ele já tem histórico: aí a comparação é entre
 * a estimativa e o extrato do mesmo veículo, e vale como aferição do modelo.
 */
export const pickReferenceCar = (cars = [], currentCarId = null) => {
  const withData = cars
    .map((car) => ({ car, insights: expenseInsights(car) }))
    .filter((item) => item.insights.monthlyAverage);

  if (!withData.length) return null;

  const self = withData.find((item) => String(item.car.id) === String(currentCarId));
  if (self) return { ...self, isSelf: true };

  // Sem o próprio carro, vale o mais documentado: mais lançamentos significa
  // média menos sujeita a um mês fora da curva.
  const best = withData.sort(
    (a, b) => b.insights.expenses.length - a.insights.expenses.length,
  )[0];
  return { ...best, isSelf: false };
};
