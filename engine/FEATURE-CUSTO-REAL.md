# Feature: Custo Real de Posse (TCO) — Notas de Sessão

**Data:** 2026-07-17
**Status:** Implementado e aprovado. Lint + build limpos. **Nada commitado ainda.**

A feature principal do Engine: em vez de só cadastrar uma meta pela FIPE, o
usuário simula **quanto precisa ganhar por mês para comprar e manter** o carro,
com breakdown de cada gasto, plano de entrada/poupança e comparação entre metas.

---

## 1. Arquivos criados

| Arquivo | O que é |
|---|---|
| `src/services/ownership.js` | Motor de cálculo puro (TCO). Sem dependências de UI. |
| `src/components/OwnershipModal.jsx` | Modal do simulador (form à esquerda, resultado ao vivo à direita). |
| `src/components/InfoTip.jsx` | Tooltip educativo reutilizável ("?", hover no desktop / toque no mobile). |

## 2. Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/services/db.js` | `normalizeCar` preserva `car.ownership` (com `country`/`state`). Import de `normalizeOwnershipInputs`. `communityCarPatch` **não** inclui ownership (dados financeiros não vazam pra comunidade). |
| `src/components/CarCard.jsx` | Botão rodapé "Custo real/mês" (mostra valor se simulado, senão "Simular"); respeita `hideValues`. Prop `onOpenOwnership`. |
| `src/pages/Garagem.jsx` | Repassa `onOpenOwnership` ao CarCard. |
| `src/pages/DashboardPage.jsx` | Comparador de custo real (tabela ordenada por custo/mês, badge "Mais acessível", clique abre o simulador). Recebe `settings` e `onOpenOwnership`. |
| `src/App.jsx` | Estado `ownershipCar` + `saveOwnershipAction`; monta `OwnershipModal`; passa props à Garagem e ao Dashboard. |
| `src/services/i18n.js` | Namespace `ownership` completo + chaves `dashboard.compare*` em pt-BR/en-US/es-ES. **Bug corrigido:** chave duplicada `createService` em `servicesPt`. |

---

## 3. O motor (`ownership.js`)

`estimateOwnership(car, inputs, { country, state })` combina:

- **IPVA 2026 por UF** (SP/MG/RJ 4%, PR 1,9%, SC/ES 2%, GO 3,75%…) — Brasil; outros
  12 países usam perfis genéricos (`COUNTRY_PROFILES`).
- **Licenciamento** anual por UF.
- **Seguro** pela curva etária SUSEP (18–25 ≈ 9,5% do valor/ano; 56+ ≈ 4,4%),
  ajustado por região, garagem, uso e cobertura.
- **Combustível** ANP jul/2026 (gasolina R$6,61/L, etanol R$4,49/L) × consumo × km/mês,
  com fator por UF.
- **Manutenção** por idade do carro e rodagem.
- **Financiamento** tabela Price (default 1,99% a.m. no BR).
- **Depreciação** (informativa).
- **Regra de comprometimento de renda** adaptada à situação de vida (ver abaixo).

Exports: `estimateOwnership`, `normalizeOwnershipInputs`, `defaultOwnershipInputs`,
`DEFAULT_CONSUMPTION`, `FUEL_TYPES`, `AGE_BANDS`, `COVERAGE_TYPES`, `USAGE_TYPES`,
`LIFE_SITUATIONS`, `LIFE_SITUATION_TYPES`.

### Situação de vida (define os limites de conforto)

```
with_family  → sugere 35% da renda | confortável ≤35% | atenção ≤45%
shared       → sugere 20% da renda | confortável ≤20% | atenção ≤30%
independent  → sugere 15% da renda | confortável ≤15% | atenção ≤25%
```

`incomeSharePct` é campo **livre** (clamp 5–60%), não mais select fixo. Trocar a
situação preenche a % sugerida, mas o usuário edita à vontade.

---

## 4. O que a UI entrega ao usuário

- **Custo total/mês** e **renda necessária** (números principais, ao vivo).
- **Breakdown** com % de cada item: parcela, IPVA, licenciamento, seguro,
  combustível, manutenção, extras, depreciação. Cada linha tem tooltip educativo.
- **Selo de conforto** (Confortável/Atenção/Crítico) quando a renda é informada —
  agora respeita a situação de vida + a % escolhida.
- **Raio-x do financiamento**: entrada, valor financiado, total de juros, custo final.
- **Plano para conquistar**: entrada ideal (25%), reserva de emergência, e
  **plano de poupança** (chips 6/12/24 meses = quanto guardar/mês).
- **Barra sticky no mobile** com resultado sempre à vista ao editar o form.
- **Comparador no Dashboard**: qual meta cabe primeiro no bolso.

---

## 5. ONDE PARAMOS / próximos passos

**Tudo NÃO COMMITADO** na working tree do git aninhado
(`engine-main/engine-main`, branch `main`, último commit real `4055314`).
Junto com as levas visuais 1–7 anteriores: ~22 modificados + 12 novos não rastreados.

Pendências, em ordem:

1. **Commitar** o trabalho acumulado em commits organizados (sem backup no git ainda).
2. **Teste E2E logado** — nunca foi feito (precisa do login Firebase). Rodar
   `npm run dev` dentro de `engine`, abrir Garagem e Dashboard, desktop + mobile.
3. Renda mensal lembrada no perfil (pré-preencher simulações).
4. Atualização automática dos preços de combustível via Engine API.
5. Usar `preferences.annualIncomeGoal` de alguma forma.

### Como rodar

```bash
cd engine-main/engine-main/engine
npm run dev      # Vite (5173 ou próxima)
npm run build    # validar build
npx eslint src/...
```

Só a tela de login é visível sem autenticar (shell precisa de login Firebase).

---

## 6. Referência técnica do motor

### Entrada — `inputs` (após `normalizeOwnershipInputs`)

| Campo | Tipo / faixa | Default | Observação |
|---|---|---|---|
| `kmPerMonth` | 100–20000 | 1000 | km rodados por mês |
| `fuelType` | `gasoline` \| `ethanol` \| `diesel` \| `electric` | `gasoline` | |
| `consumption` | 0–50 | 0 | 0 = usa média do combustível (`DEFAULT_CONSUMPTION`) |
| `driverAgeBand` | `18-25` \| `26-35` \| `36-55` \| `56+` | `18-25` | curva de seguro |
| `hasGarage` | bool | true | fator 0,88 (com) / 1,12 (sem) |
| `coverage` | `full` \| `thirdparty` \| `none` | `full` | |
| `usage` | `personal` \| `commute` \| `app` | `personal` | fator de seguro 1 / 1,08 / 1,35 |
| `purchaseMode` | `finance` \| `cash` | `finance` | |
| `downPaymentValue` | ≥0 | 0 | 0 = usa `car.savedValue` |
| `financeMonths` | 6–72 | 48 | |
| `monthlyRatePct` | 0–15 | 0 | 0 = taxa média do país |
| `lifeSituation` | `with_family` \| `shared` \| `independent` | `shared` | define limites de conforto |
| `incomeSharePct` | 5–60 | 20 | campo livre |
| `monthlyIncome` | ≥0 | 0 | opcional; ativa o selo de conforto |
| `parkingMonthly` / `tollsMonthly` | ≥0 | 0 | extras |

`car.ownership` guarda esses inputs **+ `country` e `state`** (adicionados no modal, não fazem
parte de `normalizeOwnershipInputs`).

### Saída — `estimateOwnership(...)` retorna

```
{
  inputs, country, state, value, carAge,
  monthly: { financing, tax, licensing, insurance, fuel,
             maintenance, parking, tolls, depreciation },   // todos R$/mês
  totals:  { monthlyMaintain, monthlyTotal,                 // maintain = sem parcela
             annualMaintain, annualTotal },
  financing: null | { downPayment, downPaymentPct, principal, months,
                      monthlyRate, installment, totalPaid, totalInterest },
  recommendations: {
    requiredIncomeTotal, requiredIncomeMaintain,
    recommendedDownPayment, recommendedDownPaymentPct (0.25),
    emergencyFund, incomeSharePct, suggestedSharePct,
    comfortThresholds: { comfortable, warning },            // frações (0–1)
    committedPct,                                            // null se sem renda
    comfortLevel,                                            // 'comfortable'|'warning'|'critical'|null
    downPaymentGap,
  },
}
```

> Nota de ano-modelo: `parseCarYear` extrai o ano do texto da FIPE (ex.: "2023 Gasolina").
> Zero-km ("32000") ou ano futuro caem no ano corrente. `carAge` alimenta seguro,
> manutenção e depreciação.

---

## 7. Fontes dos números (pesquisa de 2026-07-17)

- **IPVA 2026 por UF** — CNN Brasil, Serasa, Zul+ (faixa 1,9%–4% para passeio).
- **Custo de manutenção** — Zul+, Exame, Nakata (~R$150–250/mês popular).
- **Combustível** — ANP jul/2026: gasolina R$6,61/L, etanol R$4,49/L.
- **Financiamento** — iDinheiro / Banco Central: média ~1,9–2,2% a.m.; entrada saudável 20–30%.
- **Seguro** — SUSEP via SeguroAuto.org/Neon: 18–25 pagam ~9,5% do valor/ano; 56+ ~4,4%;
  faixa geral 6–12% do valor/ano; RJ é a região mais cara.

Todos são **estimativas de planejamento**, não cotações — há disclaimer no modal.

---

## 8. Chaves i18n adicionadas (pt-BR / en-US / es-ES)

- `ownership.*` — namespace inteiro (kicker, title, subtitle, cardMonthly, cardSimulate,
  `sections.*`, `fields.*`, `fuel.*`, `usageOptions.*`, `coverageOptions.*`,
  `purchaseOptions.*`, `lifeOptions.*`, `ageBands.*`, `results.*`, `tips.*`,
  `results.savePlan*`, disclaimer, save).
- `dashboard.compare*` + `colCar/colMonthly/colIncome/colIdealDown/colDownGap`,
  `simulated`, `estimated`, `mostAffordable`, `downReady`, `compareOpenHint`, `compareNote`.

Demais idiomas (de/fr/it/ja/zh/ko/hi/ar) caem no fallback (pt-BR/en-US) — comportamento
existente do projeto, sem regressão.

---

## 9. Checklist de QA para o teste logado (amanhã)

- [ ] `npm run dev`, logar, ir na **Garagem** → card mostra "Custo real/mês → Simular".
- [ ] Abrir o simulador: país/estado vêm pré-preenchidos do perfil.
- [ ] Mudar km/mês, combustível, idade → números recalculam **ao vivo**.
- [ ] Inserir renda → selo de conforto aparece e bate com a % escolhida (sem o conflito antigo).
- [ ] Trocar "situação de moradia" → % sugerida muda; editar a % manualmente funciona.
- [ ] Financiado: raio-x (juros, total pago) e plano de poupança 6/12/24 meses coerentes.
- [ ] À vista: parcela some do breakdown; plano de poupança mira o valor cheio.
- [ ] Salvar → card passa a exibir o valor; reabrir mantém os inputs.
- [ ] **Dashboard** → tabela comparadora ordena por custo/mês, badge "Mais acessível",
      clicar numa linha abre o simulador daquele carro.
- [ ] Ativar "ocultar valores sensíveis" (Configurações) → card e tabela mostram "R$ --".
- [ ] Testar em **mobile** (DevTools responsivo): barra sticky com resultado ao vivo,
      tabela do Dashboard com scroll horizontal, tooltips abrindo por toque.
