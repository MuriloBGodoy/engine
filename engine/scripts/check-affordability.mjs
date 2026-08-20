#!/usr/bin/env node

/**
 * Verificação do veredito de "cabe ou não cabe".
 *
 * Existe por causa de um defeito específico: até 19/08/2026 o motor devolvia
 * DOIS vereditos sobre a mesma situação — o `level` do `assessAffordability`
 * (folga real depois das contas declaradas) e o `comfortLevel` do
 * `estimateOwnership` (percentual da renda). Eles discordavam em faixas
 * inteiras de renda, não num ponto, e o redesenho do simulador passou a
 * mostrar os dois juntos e grandes na mesma tela.
 *
 * Mesmo formato do `check-spec-sheet.mjs`, pelo mesmo motivo: ler o próprio
 * código e achar que está bom não é medição.
 *
 * 1. ASSERTIVAS — inclusive a que falha se um segundo veredito voltar a
 *    existir em qualquer canto do retorno de `estimateOwnership`, e a que
 *    falha se a tela puder mostrar "cabe com folga" ao lado de uma legenda
 *    dizendo que o carro come mais renda do que o saudável.
 * 2. VARREDURA MEDIDA — roda o motor real numa grade de renda × contas ×
 *    situação de vida e diz, com número, em quantas células cada zona cai e
 *    quantas o teto de fatia da renda rebaixou. É esse número que diz se a
 *    correção mexeu num canto ou na tela inteira.
 *
 * Uso:
 *   node scripts/check-affordability.mjs
 */

import {
  LIFE_SITUATIONS,
  assessAffordability,
  estimateOwnership,
  estimateOwnershipRange,
} from "../src/services/ownership.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(
      `FALHOU  ${label}\n        esperado ${JSON.stringify(expected)}\n        obtido   ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(`OK      ${label}`);
  }
  return ok;
};
const fail = (label, detail) => {
  failures += 1;
  console.error(`FALHOU  ${label}\n        ${detail}`);
};

const brl = (n) =>
  "R$ " + Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (n) => `${Math.round(n * 100)}%`;

// As três zonas que a régua do OwnershipModal desenha. Se esta lista mudar, o
// componente muda junto — ele indexa `ownership.answer.ruler.<zona>` no i18n,
// nas três línguas.
const LEVELS = ["comfortable", "tight", "no_fit"];
// Ordem de severidade, para as assertivas de monotonicidade.
const RANK = { comfortable: 0, tight: 1, no_fit: 2 };

// Vocabulário de veredito: nenhuma outra parte do motor pode devolver uma
// destas palavras. É assim que "um veredito só" vira assertiva em vez de
// promessa no comentário.
const VERDICT_WORDS = new Set([
  "comfortable",
  "tight",
  "no_fit",
  "warning",
  "critical",
]);

// Carros reais, dos dois extremos do público do Engine.
const CARS = {
  pulse: { targetValue: 92000, savedValue: 8000, year: "2024 Gasolina" },
  gol: { targetValue: 32000, savedValue: 6000, year: "2013 Flex" },
  suv: { targetValue: 200000, savedValue: 40000, year: "2025 Diesel" },
};
const SP = { country: "BR", state: "SP" };
const SC = { country: "BR", state: "SC" };

// O que o modo Padrão não pergunta — é daqui que sai o teto da faixa, que é o
// custo com que a tela faz o veredito.
const UNKNOWN = [
  "driverAgeBand",
  "hasGarage",
  "usage",
  "monthlyRatePct",
  "userConsumption",
  "kmPerMonth",
];

// Reproduz o caminho da tela: custo = TETO da faixa, renda e contas do
// `settings.budget`, situação de vida do formulário.
const screenVerdict = (car, location, income, expenses, lifeSituation, inputs = {}) => {
  const base = { ...inputs, monthlyIncome: income, lifeSituation };
  const range = estimateOwnershipRange(car, base, location, UNKNOWN);
  return {
    range,
    central: estimateOwnership(car, base, location),
    verdict: assessAffordability({
      monthlyCost: range.high,
      monthlyIncome: income,
      monthlyExpenses: expenses,
      lifeSituation,
    }),
  };
};

console.log("== 1. Assertivas ==\n");

// --- Contrato com a tela: três níveis discretos, e nada entre eles ---------
{
  const seen = new Set();
  for (const income of [1500, 3000, 5000, 8000, 11000, 20000, 40000]) {
    for (const expenses of [200, 800, 2000, 4000, 7000, 15000, 30000]) {
      for (const ls of Object.keys(LIFE_SITUATIONS)) {
        for (const [name, car] of Object.entries(CARS)) {
          const { verdict } = screenVerdict(car, SP, income, expenses, ls);
          if (!verdict) {
            fail(
              "veredito ausente com renda e contas informadas",
              `${name} ${income}/${expenses}`,
            );
            continue;
          }
          if (!LEVELS.includes(verdict.level)) {
            fail(
              "nível fora do contrato de três zonas",
              `${verdict.level} em ${name} ${income}/${expenses}`,
            );
          }
          seen.add(verdict.level);
        }
      }
    }
  }
  check("as três zonas são alcançáveis", [...seen].sort(), [...LEVELS].sort());
}

// --- Um veredito só: nada mais no motor devolve uma palavra de veredito ----
{
  const strings = [];
  const walk = (node, path) => {
    if (typeof node === "string") strings.push([path, node]);
    else if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
    }
  };
  for (const [name, car] of Object.entries(CARS)) {
    walk(
      estimateOwnership(car, { monthlyIncome: 11000, lifeSituation: "shared" }, SP),
      name,
    );
  }
  const offenders = strings.filter(([, value]) => VERDICT_WORDS.has(value));
  check(
    "estimateOwnership não emite veredito (o segundo comfortLevel não voltou)",
    offenders,
    [],
  );
  check(
    "os campos do veredito morto saíram do contrato",
    Object.keys(
      estimateOwnership(CARS.pulse, { monthlyIncome: 11000 }, SP).recommendations,
    ).filter((key) => /comfort|committed/i.test(key)),
    [],
  );
}

// --- Sem renda ou sem contas não há veredito: a tela convida a informar ----
check(
  "sem renda não há veredito",
  assessAffordability({ monthlyCost: 1000, monthlyExpenses: 2000 }),
  null,
);
check(
  "sem contas não há veredito",
  assessAffordability({ monthlyCost: 1000, monthlyIncome: 5000 }),
  null,
);

// --- A grade principal, onde moram as invariantes -------------------------
const GRID_INCOMES = [];
for (let income = 2000; income <= 40000; income += 500) GRID_INCOMES.push(income);
const GRID_EXPENSE_SHARES = [0.05, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85];

const cells = [];
for (const income of GRID_INCOMES) {
  for (const share of GRID_EXPENSE_SHARES) {
    for (const ls of Object.keys(LIFE_SITUATIONS)) {
      const expenses = income * share;
      const { range, verdict } = screenVerdict(CARS.pulse, SP, income, expenses, ls);
      cells.push({ income, expenses, share, ls, cost: range.high, ...verdict });
    }
  }
}

// A fatia da renda NUNCA reprova. Reprovar por proxy tira da pessoa um carro
// que caberia — o mesmo erro do IPVA cobrado de carro imune.
{
  const offenders = cells.filter(
    (cell) => (cell.level === "no_fit") !== (cell.leftover <= 0),
  );
  check("não cabe se e somente se a folga acabou", offenders.length, 0);
}

// A contradição que virou este trabalho: "cabe com folga" em 46px não pode
// conviver com a legenda "este carro ocuparia X% da sua renda, o típico é Y%"
// quando X passa do saudável para a situação de vida.
{
  const offenders = cells.filter(
    (cell) =>
      cell.level === "comfortable" &&
      cell.committedPct > LIFE_SITUATIONS[cell.ls].warning,
  );
  if (offenders.length) {
    const worst = offenders.sort((a, b) => b.committedPct - a.committedPct)[0];
    fail(
      "'cabe com folga' com o carro acima da fatia saudável de renda",
      `${offenders.length} células; pior: renda ${brl(worst.income)}, contas ${brl(worst.expenses)}, ${worst.ls}, carro em ${pct(worst.committedPct)} da renda`,
    );
  } else {
    console.log(
      "OK      'cabe com folga' nunca aparece acima da fatia saudável de renda",
    );
  }
}

// O rebaixamento tem de ser exatamente isto: veredito "aperta" num orçamento
// em que a folga sozinha teria dito "com folga".
{
  const offenders = cells.filter(
    (cell) =>
      cell.cappedByIncomeShare &&
      !(cell.level === "tight" && cell.leftover >= cell.income * 0.2),
  );
  check("o teto de fatia rebaixa para 'aperta', nunca para 'não cabe'", offenders.length, 0);
}

// A suspeita de orçamento incompleto só existe quando a folga aprovou.
{
  const offenders = cells.filter(
    (cell) => cell.suspectIncompleteBudget && cell.level === "no_fit",
  );
  check("não pergunta por conta faltando em quem já não coube", offenders.length, 0);
}

// Monotonicidade: mais renda nunca piora, mais conta nunca melhora, carro mais
// caro nunca melhora. Uma régua que não respeita isso é régua quebrada.
{
  let worse = 0;
  for (const share of GRID_EXPENSE_SHARES) {
    for (const ls of Object.keys(LIFE_SITUATIONS)) {
      const line = cells
        .filter((cell) => cell.share === share && cell.ls === ls)
        .sort((a, b) => a.income - b.income);
      for (let i = 1; i < line.length; i += 1) {
        if (RANK[line[i].level] > RANK[line[i - 1].level]) {
          worse += 1;
          if (worse === 1) {
            fail(
              "mais renda piorou o veredito",
              `${brl(line[i - 1].income)} → ${line[i - 1].level}; ${brl(line[i].income)} → ${line[i].level} (contas ${pct(share)} da renda, ${ls})`,
            );
          }
        }
      }
    }
  }
  if (!worse) console.log("OK      mais renda nunca piora o veredito");
}
{
  let better = 0;
  for (const income of GRID_INCOMES) {
    for (const ls of Object.keys(LIFE_SITUATIONS)) {
      const line = cells
        .filter((cell) => cell.income === income && cell.ls === ls)
        .sort((a, b) => a.expenses - b.expenses);
      for (let i = 1; i < line.length; i += 1) {
        if (RANK[line[i].level] < RANK[line[i - 1].level]) better += 1;
      }
    }
  }
  check("mais conta fixa nunca melhora o veredito", better, 0);
}
{
  let better = 0;
  let previous = null;
  for (let value = 20000; value <= 300000; value += 5000) {
    const car = { targetValue: value, savedValue: 8000, year: "2024 Gasolina" };
    const { verdict } = screenVerdict(car, SP, 12000, 4000, "shared");
    if (previous && RANK[verdict.level] < RANK[previous]) better += 1;
    previous = verdict.level;
  }
  check("carro mais caro nunca melhora o veredito", better, 0);
}

// A troca de carro não conta carro duas vezes. Regressão barata de guardar: o
// erro era grande o bastante para virar o veredito sozinho.
{
  const withoutReplace = assessAffordability({
    monthlyCost: 1500,
    monthlyIncome: 6000,
    monthlyExpenses: 3000,
    currentCarCost: 800,
  });
  const withReplace = assessAffordability({
    monthlyCost: 1500,
    monthlyIncome: 6000,
    monthlyExpenses: 3000,
    currentCarCost: 800,
    replacingCurrentCar: true,
  });
  check(
    "trocar de carro libera o gasto do carro atual",
    [
      withoutReplace.ongoingExpenses,
      withReplace.ongoingExpenses,
      withReplace.leftover - withoutReplace.leftover,
    ],
    [3000, 2200, 800],
  );
}

console.log("\n== 2. Varredura medida ==\n");

// O caso medido pelo Jesse, que abriu o defeito.
{
  const { range, central, verdict } = screenVerdict(CARS.pulse, SP, 11000, 3500, "shared");
  console.log("Pulse R$ 92.000/2024, SP, financiado 48x, entrada = R$ 8.000 poupados");
  console.log(
    `  custo por mês: piso ${brl(range.low)} · central ${brl(central.totals.monthlyTotal)} · teto ${brl(range.high)}`,
  );
  console.log("  renda R$ 11.000 · contas R$ 3.500 · mora com outra pessoa");
  console.log(
    `  veredito: ${verdict.level} · sobra ${brl(verdict.leftover)} · ${pct(verdict.committedPct)} da renda (típico ${verdict.typicalSharePct}%)`,
  );
  console.log(`  suspeita de orçamento incompleto: ${verdict.suspectIncompleteBudget}`);
  console.log(`  rebaixado pela fatia de renda: ${verdict.cappedByIncomeShare}`);
  console.log("");
}

// Onde o teto de fatia de renda pega, na grade inteira.
{
  const total = cells.length;
  const tally = LEVELS.map(
    (level) => `${level} ${cells.filter((cell) => cell.level === level).length}`,
  ).join(" · ");
  const capped = cells.filter((cell) => cell.cappedByIncomeShare);
  console.log(
    `Grade: ${total} células (renda R$ 2.000–40.000 × contas 5–85% da renda × 3 situações)`,
  );
  console.log(`  zonas: ${tally}`);
  console.log(
    `  rebaixadas pelo teto de fatia de renda: ${capped.length} (${pct(capped.length / total)} da grade)`,
  );
  if (capped.length) {
    const byLs = Object.keys(LIFE_SITUATIONS).map((ls) => {
      const rows = capped.filter((cell) => cell.ls === ls);
      const max = rows.length ? Math.max(...rows.map((row) => row.income)) : 0;
      return `${ls} ${rows.length}${rows.length ? ` (até renda ${brl(max)})` : ""}`;
    });
    console.log(`  por situação de vida: ${byLs.join(" · ")}`);
  }
  console.log("");
}

// A linha que a tela mostra, para conferir a olho.
{
  console.log("Renda × veredito (Pulse, contas = 40% da renda, mora com outra pessoa)");
  console.log(
    "renda        contas       teto/mês     sobra        % renda   veredito     rebaixado",
  );
  for (const income of [5000, 8000, 11000, 14000, 17000, 20000, 23000, 26000, 30000]) {
    const expenses = income * 0.4;
    const { range, verdict } = screenVerdict(CARS.pulse, SP, income, expenses, "shared");
    console.log(
      `${brl(income).padEnd(12)} ${brl(expenses).padEnd(12)} ${brl(range.high).padEnd(12)} ${brl(verdict.leftover).padEnd(12)} ${pct(verdict.committedPct).padEnd(9)} ${verdict.level.padEnd(12)} ${verdict.cappedByIncomeShare ? "sim" : ""}`,
    );
  }
  console.log("");
}

// O caso que o teto foi criado para pegar: contas baixas, carro caro.
{
  console.log("Contas baixas, carro caro (Pulse, renda R$ 11.000, mora com outra pessoa)");
  console.log("contas       sobra        % renda   veredito     rebaixado");
  for (const expenses of [500, 1000, 1500, 2000, 2500, 3500, 4500, 5500]) {
    const { verdict } = screenVerdict(CARS.pulse, SP, 11000, expenses, "shared");
    console.log(
      `${brl(expenses).padEnd(12)} ${brl(verdict.leftover).padEnd(12)} ${pct(verdict.committedPct).padEnd(9)} ${verdict.level.padEnd(12)} ${verdict.cappedByIncomeShare ? "sim" : ""}`,
    );
  }
  console.log("");
}

// Quem mora com a família tem teto mais alto de propósito: conta fixa quase
// zero é justamente o perfil que a régua de percentual reprovava sem razão.
{
  console.log("Mesma conta, três situações de vida (Pulse, renda R$ 14.000, contas R$ 1.500)");
  console.log("situação        teto saudável   % renda   veredito     rebaixado");
  for (const ls of Object.keys(LIFE_SITUATIONS)) {
    const { verdict } = screenVerdict(CARS.pulse, SP, 14000, 1500, ls);
    console.log(
      `${ls.padEnd(15)} ${pct(LIFE_SITUATIONS[ls].warning).padEnd(15)} ${pct(verdict.committedPct).padEnd(9)} ${verdict.level.padEnd(12)} ${verdict.cappedByIncomeShare ? "sim" : ""}`,
    );
  }
  console.log("");
}

// Um carro que cabe de verdade, para a régua não virar só uma máquina de negar.
{
  const { range, verdict } = screenVerdict(CARS.gol, SC, 6000, 2200, "with_family");
  console.log(
    "Gol R$ 32.000/2013, SC, financiado, renda R$ 6.000, contas R$ 2.200, mora com a família",
  );
  console.log(
    `  teto ${brl(range.high)} · sobra ${brl(verdict.leftover)} · ${pct(verdict.committedPct)} da renda · veredito ${verdict.level}`,
  );
  console.log("");
}

console.log(failures ? `${failures} FALHA(S)` : "Tudo certo.");
process.exit(failures ? 1 : 0);
