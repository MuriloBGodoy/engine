# Simulador — de onde vêm (e de onde deveriam vir) os números

Levantamento de 11/08/2026. Cada constante de `ownership.js` está aqui com a
fonte real que a substituiria, o que já foi verificado buscando de verdade e o
que é só menção encontrada.

O princípio que rege este documento: **nenhuma constante do simulador deveria
existir sem uma linha aqui.** Onde não há fonte, o código diz que é chute.

---

## Ranking por impacto

| # | Fonte | Constante | Erro medido | Esforço |
| --- | --- | --- | --- | --- |
| 1 | FIPE tabelas históricas | `annualDepreciationRate` | 2× a 100× superestimado | Médio |
| 2 | ANP série histórica | `FUEL_PRICE_BR`, `FUEL_FACTOR_BR` | até 9,3 p.p. por UF | Baixo |
| 3 | Legislação estadual | `IPVA_BR` | AM 2× errado | Alto, manual |
| 4 | SUSEP AUTOSEG | `INSURANCE_AGE_RATES` | desconhecido, provavelmente grande | Alto |
| 5 | BCB SGS 25471 | `monthlyRate` | ~0,02 p.p. hoje | Trivial |

---

## 1. Depreciação — o maior erro numérico

A API interna da FIPE expõe 336 tabelas mensais e responde sem autenticação:

```
POST https://veiculos.fipe.org.br/api/veiculos/ConsultarTabelaDeReferencia
POST https://veiculos.fipe.org.br/api/veiculos/ConsultarValorComTodosParametros
Header obrigatório: Referer: https://veiculos.fipe.org.br/
```

Comparando **o mesmo carro** em tabelas de anos diferentes (verificado):

| Modelo | idade | depreciação real/ano | nossa curva |
| --- | --- | --- | --- |
| Argo 1.0 2024 | 2 | −4,5% | 12% |
| Polo MPI 2024 | 2 | −0,1% | 12% |
| Argo 1.0 2020 | 6 | −3,0% | 6% |

Num carro de R$ 70 mil isso é ~R$ 350/mês de custo fantasma na maior linha do
orçamento.

**Ressalva que impede a correção imediata:** FIPE é preço nominal em BRL. Com
IPCA de 4–5% ao ano, a depreciação real é maior que a nominal, e uma amostra de
um único ano pode estar capturando um efeito de período em vez da curva. Antes
de recalibrar, é preciso amostrar vários anos e vários segmentos.

**Não é API oficial** — é o backend do site da FIPE, sem termos de uso nem SLA.
O mesmo vale para o `parallelum.com.br` que já está em produção. Se for usado,
que seja por job assíncrono com cache no Firestore, nunca no caminho da UI.

## 2. Combustível — melhor relação ganho/esforço

⚠️ `dadosabertos.anp.gov.br` **não resolve** (falha de DNS). É a URL mais citada
em tutoriais e está morta.

O que funciona (verificado, HTTP 200, 7,9 MB, 46.236 linhas):

```
https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-gasolina-etanol.csv
```

CSV `;`, granularidade de posto individual por município. Sem API REST.
Republicado semanalmente. Dado aberto federal, uso comercial permitido.

Calibração sobre 17.640 postos: média nacional real **R$ 6,604/L** contra os
R$ 6,61 do código — a média nacional está certa. Os fatores por UF não:

| UF | real | código | erro |
| --- | --- | --- | --- |
| AP | 0,987 | 1,08 | −9,3 p.p. |
| AM | 1,127 | 1,06 | +6,7 |
| RR | 1,146 | 1,08 | +6,6 |
| RS | 0,954 | 1,02 | −6,6 |

Não cobre energia elétrica. Candidata para isso: ANEEL dados abertos (não
verificada).

## 3. IPVA e licenciamento — não existe fonte consolidada

Não há API, dataset ou CKAN. São 27 leis estaduais, revisão anual. Os
agregadores existentes são conteúdo editorial de terceiros.

### Conferência de 13/08/2026 — corrigido

| UF | era | virou | fonte |
| --- | --- | --- | --- |
| AM | 3,0% | **2,0%** (1,5% elétrico) | LC estadual 280/2025; SEFAZ/AM, Agência Amazonas, LegisWeb |
| CE | 3,1% | **3,0%** | Diário do Nordeste e agregadores; secundária |
| PR | 1,9% | 1,9%, **sem mudança** | Fazenda/PR e DETRAN/PR: Lei 22.645/2025 |

O Amazonas escalona: 1,5% até 1.000 cc e para elétrico/híbrido, 2,0% acima
(antes 3% e 4%). Como o simulador não conhece cilindrada, ficou na faixa maior
— errar para cima é o lado que não empurra ninguém para uma parcela impagável.

A suspeita sobre o PR estava errada: 1,9% é a alíquota vigente, confirmada em
fonte primária, e o código já estava certo.

**Ainda em aberto — `MT: 0.0345`.** Uma matéria da SEFAZ/AM que ranqueia os
estados lista MT em 2%; a legislação do MT (Lei 7.301/2000, Decreto 1.977/2000)
dá a faixa de 1% a 4% sem que a alíquota de passeio apareça em fonte primária
acessível. Não mexer sem confirmar: 3,45% é um número específico demais para ter
sido inventado, e pode ser média ponderada de faixas.

**Erro estrutural que continua:** `IPVA_BR` é um escalar por UF, e a realidade é
uma matriz UF × cilindrada × combustível. Existe agora um `IPVA_BR_ELECTRIC`,
mas só com AM — a regra é que uma UF só entra ali depois de confirmada, e
ausência significa "não conferido", não "não reduz". MT e CE aparecem em fontes
secundárias com redução para elétrico (1,5% e metade da alíquota,
respectivamente) e ficam de fora até conferir.

Recomendação: aceitar que é manual, mover para o Firestore com `updatedAt` e
`sourceUrl`, e mostrar a data na tela.

## 4. Seguro — beco sem saída parcial

**A curva atual não tem fonte.** O comentário credita SUSEP, mas a SUSEP publica
frequência e severidade de sinistro, não prêmio como % do valor FIPE por faixa
etária. Os números 9,5% / 6,5% / 5,5% / 4,5% são chute vestido de fonte.

**AUTOSEG está congelado em 2020.** Verificado semestre a semestre:

```
Autoseg2021A  200   ← 2º semestre de 2020, 535 MB
Autoseg2021B  404
... até 2026A 404
```

Os portais `gov.br/susep/dados-abertos` e `dados.susep.gov.br` retornam 404.

O que ainda serve: os **fatores relativos** (razão 18-25 / 36-55, razão RJ / SC)
envelhecem devagar. Extrair do arquivo de 2020 e ancorar o nível num parâmetro
calibrável é melhor que os quatro números de hoje — e é honesto rotular como
"base SUSEP 2020".

**Open Insurance Brasil** tem API pública sem autenticação, chaveada por CEP +
código FIPE + ano, com 13 seguradoras. Verificado:

```
GET https://open-api.portoseguro.com.br/open-insurance/products-services/v1/auto-insurance/01310100/0055336/2023
→ 200, 158 KB
```

**Mas não publica prêmio.** Das 104 chaves do payload, as únicas com "prem" são
forma de pagamento. Publica **franquia** (`deductiblePercentage`), que o
simulador ignora hoje e poderia mostrar como informação complementar.

Cotação real exige mTLS ICP-Brasil e registro de corretora na SUSEP. Não é
problema de engenharia, é decisão de parceria comercial.

## 5. Juros — integrar, é trivial

Única API oficial, JSON, gratuita, sem chave, licença ODbL:

```
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.25471/dados/ultimos/3?formato=json
→ [{"data":"01/06/2026","valor":"1.97"}, ...]
```

Série 25471 = taxa média mensal de aquisição de veículos, PF. Hoje 1,97% contra
os 1,99% do código — ganho imediato nulo. O valor é não apodrecer: a mesma série
marcava 1,63% em 2019.

## 6. Consumo — dead end no Brasil

INMETRO/PBE Veicular só publica **PDF**. Nenhum CSV, nenhuma API. 794 modelos no
ciclo 2026. Licença CC Atribuição-**SemDerivações**, o que é uma questão
jurídica real se formos redistribuir tabela derivada.

Para os EUA existe a API pública do EPA (`fueleconomy.gov/ws/rest/...`, domínio
público, verificada), mas os modelos não coincidem com o mercado brasileiro.

Prioridade baixa: são 4 constantes que a pessoa já pode sobrescrever.

## 7. Manutenção — não existe fonte pública brasileira

Nenhuma. AAA e Edmunds são americanos, com copyright: a metodologia é copiável,
os números não são redistribuíveis. Cesvi e Sindipeças são comerciais.

A fórmula atual usa **% do valor do carro**, o que é conceitualmente frágil —
manutenção escala com complexidade mecânica e preço de peça, não linearmente
com valor FIPE. A metodologia AAA (custo por km, por categoria, com curva de
idade) é mais defensável.

**A saída boa:** o `expenses.js` coleta gasto real de manutenção dos usuários.
Com volume, isso vira o único dataset brasileiro que existe sobre o assunto.
É vantagem competitiva, não plano B.

---

## Sequenciamento sugerido

**Agora:** ANP semanal e BCB mensal para o Firestore; corrigir o IPVA do AM.

**Depois:** job mensal de amostragem FIPE para calibrar a depreciação, com
amostra ampla o bastante para não confundir efeito de período com curva.

**Projeto próprio:** baixar o AUTOSEG 2020 e extrair os fatores relativos de
seguro.

**Não fazer:** pipeline de PDF do INMETRO; pipeline por país para seguro
internacional (11 publicações anuais para calibrar 11 escalares — calibra uma
vez à mão); procurar API de cotação de seguro, que está bloqueada por regulação.
