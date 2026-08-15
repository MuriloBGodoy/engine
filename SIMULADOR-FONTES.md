# Simulador — de onde vêm (e de onde deveriam vir) os números

Levantamento de 11/08/2026, revisado em 14/08/2026. Cada constante de `ownership.js` está aqui com a
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

### Recalibrada em 13/08/2026

Feito por corte transversal na API pública (`parallelum.com.br/fipe`, tabela de
agosto/2026): **90 pares de anos-modelo consecutivos, 21 modelos**, de Mobi e
Kwid a Hilux, Tucson, 320i e Classe C. Mede o que um ano a mais de idade custa
hoje, que é o número que interessa a quem está decidindo a compra.

| idade | mediana real | média | curva antiga | curva nova |
| --- | --- | --- | --- | --- |
| 1 | 9,7% | 8,8% | 16% | **10%** |
| 2 | 6,2% | 5,7% | 12% | **7%** |
| 3 | 7,4% | 6,9% | 10% | **7%** |
| 4–5 | 4,9% | 5,2% | 8% | **5,5%** |
| 6–8 | 3,9% | 4,7% | 6% | **5%** |
| 9+ | 3,9% | 5,2% | 4% | **5,5%** |

A curva antiga era o padrão americano: despencava no primeiro ano e achatava. O
mercado brasileiro é bem mais plano — a queda medida fica entre 4% e 10% do
começo ao fim da vida do carro.

Na ponta velha ficou na **média** e não na mediana, de propósito: as idades de
12 a 15 anos medem 6% a 9%, e subestimar depreciação faz o carro parecer mais
barato do que é.

**Ressalva que continua valendo:** é corte transversal de uma tabela só, não
série temporal. Não separa depreciação de efeito de safra, e FIPE é preço
nominal — com IPCA de 4–5% ao ano, a perda real de poder de compra é maior. Uma
série longitudinal (mesmo carro em tabelas de anos diferentes) ainda vale.

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

### Aplicado em 14/08/2026 — e o erro maior não era o que estava mapeado

Remedido sobre a coleta de 07-08/2026: **17.619 postos de gasolina e 14.989 de
etanol**. Preços nacionais: gasolina **R$ 6,594** (código dizia 6,61, erro de
0,2%) e etanol **R$ 4,283** (código dizia 4,49, **4,8% alto**). Os dois foram
para 6,59 e 4,28.

O achado que não estava no levantamento anterior: **gasolina e etanol precisam
de tabelas de fator separadas.** O código aplicava um fator único por UF aos
dois, e eles não têm nada a ver um com o outro — a gasolina segue frete e ICMS
a partir da refinaria, o etanol segue distância da usina. Onde se planta cana o
etanol é barato e a gasolina não é:

| UF | fator gasolina | fator etanol | diferença |
| --- | --- | --- | --- |
| SP | 0,97 | **0,86** | −10,6 p.p. |
| MT | 1,03 | **0,87** | −16,1 p.p. |
| RS | 0,96 | **1,09** | +13,6 p.p. |
| RJ | 1,01 | **1,12** | +10,9 p.p. |
| SC | 0,99 | **1,07** | +7,9 p.p. |

Em SP o simulador cobrava 12% a mais de etanol do que ele custa — R$ 93/mês na
maior linha do orçamento. Existem agora `FUEL_FACTOR_BR` (gasolina, e o diesel
cai nela por falta de dado) e `FUEL_FACTOR_BR_ETHANOL`. O AP ficou de fora da
tabela de etanol: 3 postos na amostra não sustentam média, e sem entrada cai
em 1.

Sai de graça do mesmo dado: em SP o etanol está a **57,8%** do preço da
gasolina, bem abaixo da paridade de 70%. Um flex em SP deveria rodar a etanol e
o simulador ainda não diz isso.

**O que este CSV não cobre:** diesel (é outro arquivo da ANP, não baixado — o
valor segue o de jul/2026, não reconferido) e energia elétrica. Candidata para
o kWh: ANEEL dados abertos, não verificada.

## 3. IPVA e licenciamento — não existe fonte consolidada

Não há API, dataset ou CKAN — reconfirmado em 14/08/2026 com teste, não só
busca: a BrasilAPI tem `/api/taxas/v1` (só Selic, CDI e IPCA) e devolve 404 em
`/api/ipva/v1`; nenhum repositório público mantém a tabela; as APIs comerciais
(Infosimples, Celcoin, APIBrasil) consultam débito por placa + RENAVAM, o que é
inútil aqui por construção — o simulador roda sobre um carro que a pessoa ainda
não tem. O que as SEFAZ publicam em formato estruturado é a tabela de valores
venais, que é base de cálculo, não alíquota.

Mas a estrutura do problema mudou: **não são mais 27 leis estaduais soltas.**

### EC 137/2025 — imunidade nacional acima de 20 anos (aplicada em 14/08/2026)

Promulgada em 09/12/2025, vigente desde a publicação, acrescenta a alínea "e" ao
art. 155, § 6º, III da Constituição:

> "veículos terrestres de passageiros, caminhonetes e mistos com 20 (vinte) anos
> ou mais de fabricação, excetuados os micro-ônibus, ônibus, reboques e
> semirreboques."

Texto conferido na base Legin da Câmara (reprodução da publicação original no
DOU). É **imunidade**, não isenção: o estado perdeu competência, então vale em
toda UF sem depender de lei estadual. Confirmada de forma independente pela
SEFAZ/PE, que não tinha regra de idade própria e publicou aviso aplicando-a ao
IPVA 2026.

Agora o mapa é **um teto constitucional único mais 27 regras que só podem ser
mais generosas**. Por isso `IPVA_BR_EXEMPT_AGE` só lista quem isenta ANTES dos
20, e a ausência cai no piso de 20 — que erra para cima, o lado seguro.

| UF | idade | fonte | camada |
| --- | --- | --- | --- |
| GO | 15 | Lei 11.651/91; FAQ da Secretaria da Economia | primária |
| RJ | 16 ("mais de 15") | Lei 2.877/97 art. 5º VII; SEFAZ-RJ isenta 2010 e anteriores | primária |
| MT | 18 | Lei 10.252/2017 (altera a 7.301/2000) | portal da ALMT, falta o texto da lei |
| SP, RS | 21 pela lei estadual, 20 pela EC | Lei 13.296/2008 art. 13 VIII | primária |

**Em aberto:** ~15 UFs sem confirmação primária (o "grupo dos 15 anos" segundo
agregador: AM, CE, ES, MA, PA, PB, PI, RO, SE, mais BA, RN e DF). AP e RR são as
mais generosas (10 anos) e as menos confiáveis: agregadores diferentes deram 10,
15 e 20 para RR na mesma semana, e o DETRAN/AP responde 403 a requisição
automatizada. Custo estimado: um dia de trabalho, mais recoleta anual.

**Ressalva que não some:** a norma fala em ano de FABRICAÇÃO e a FIPE só dá o
ano-MODELO, que é igual ou um ano maior. O motor enxerga o carro até um ano mais
novo e atrasa a isenção. Na fronteira exata (2006 no exercício 2026) há litígio:
o fisco paulista cobrou alegando fato gerador em 1º de janeiro e foi afastado em
1ª instância (proc. 1001145-07.2026.8.26.0053).

### SP conferido na lei — 4% inclusive para flex (14/08/2026)

Hipótese testada e **refutada**: a Lei 13.296/2008 escalona a alíquota, e havia
faixa reduzida para álcool/GNV/eletricidade, o que faria `SP: 0.04` estar errado
para quase toda a frota. Não está.

- Art. 9º, III (redação da Lei 17.473/2021): **4% para "qualquer veículo
  automotor não incluído nos incisos I e II"** — automóvel de passeio cai aqui.
- A faixa de 3% foi **revogada pela Lei 17.293/2020**.
- Mesmo sob a redação antiga, flex nunca entraria: exigia motor para funcionar
  **"exclusivamente"** a álcool, GNV ou eletricidade.
- Só escapam locadora (1%, § 1º) e GNV adaptado em carro fabricado até
  31/12/2008 (3%, § 3º).

A página "Como é calculado o IPVA" do portal da Fazenda-SP responde 200 com
94 KB de chrome de SharePoint e **uma frase** de conteúdo, mandando consultar o
sistema pelo RENAVAM. Quem responde é o texto consolidado em
`legislacao.fazenda.sp.gov.br`.

**O que existe em SP é isenção de HÍBRIDO, e tem prazo.** Disposições
Transitórias art. 5º (acrescido pela Lei 18.065/2024, Portaria SRE-94/24):
híbrido de motor elétrico + combustão a etanol, até R$ 250.000 corrigidos por
IPCA, **isento em 2025 e 2026**; depois 1% em 2027, 2% em 2028, 3% em 2029, 4%
de 2030. O 100% elétrico **não** entra — o dispositivo cobre hidrogênio
exclusivo ou híbrido com motor a combustão, e um BEV não é nenhum dos dois, o
que confirma manter SP fora de `IPVA_BR_ELECTRIC`. O gap do híbrido está
documentado no código e vale R$ 600/mês num carro de R$ 180 mil.

### Duas aproximações estruturais que a leitura da lei expôs

1. **A base de cálculo não é a FIPE.** Em SP é tabela própria da SEFAZ (art. 7º,
   §§ 1º-2º), publicada por resolução e congelada nos preços médios de
   **setembro do ano anterior** — 4 a 15 meses de defasagem contra a FIPE do mês
   corrente, que é o que o motor usa. Em usado com preço nominal em alta a base
   tende a ser menor, então superestimamos. **Não medido** — mediria fácil com a
   tabela da Resolução SFP-40/25 cruzada contra a FIPE.
2. **Zero km paga proporcional** aos meses restantes do ano (art. 11). O motor
   cobra o ano cheio porque não sabe o mês da compra.

### Uma exceção à afirmação de que não há dado estruturado

A **Resolução SFP-40/25** (DOE de 12/12/2025) divulga os valores de mercado de
veículos usados de SP para o exercício 2026 — tabela marca × modelo × ano em
reais, por ato oficial. Não é API nem dado aberto formal, e **o formato do anexo
não foi verificado**: se for PDF morre ali, se for planilha vira a série que
permite medir o viés FIPE × base-IPVA. Registrado como pista, não como fonte.

### Suspeitos de erro para baixo — MS, PI e BA

Levantados por diff contra uma calculadora comercial (camada 5, oráculo de
teste), que declara usar a **média** entre faixas quando a UF escalona. Nas 27
UFs, 20 batem. Das 7 divergências, quatro têm explicação (AM: a calculadora está
desatualizada e nós temos primária; DF, PE e AL: média abaixo da nossa faixa
máxima, direção segura). **MS, PI e BA são as únicas em que a média dela supera
a nossa faixa máxima**, o que só é possível se a faixa real for maior — ou seja,
o único lugar da tabela onde podemos estar errando **para baixo**. Conferir na
lei. Três leis, ~40 min cada.

O mesmo diff corroborou o MT em 3,0% por terceira via: um agregador comercial
concordando com a portaria contra os 3,45% que circulam é sinal razoável de que
aquele número nunca teve origem legal.

### MT corrigido de 3,45% para 3,0% (14/08/2026)

**Portaria SEFAZ-MT 196/2025**, art. 2º, VII (DOE Edição Extra de 23/12/2025):
3% para veículo de passeio acima de 1.000 cc, 2% até 1.000 cc. Pela regra da
faixa maior, `MT: 0.03`.

Hipótese sobre a origem do erro, não comprovada: 3,45% é exatamente a alíquota
de **utilitários em Goiás**, confirmada na FAQ da Secretaria da Economia/GO na
mesma pesquisa. Cheira a contaminação entre UFs vizinhas na montagem da tabela.

A mesma portaria **não tem inciso de elétrico ou híbrido** — a redução de 1,5%
que os agregadores atribuem ao MT não está na norma vigente.

### Licenciamento — conferido, e é ruído

| UF | código | verificado 2026 | fonte |
| --- | --- | --- | --- |
| SP | 167 → **174** | 174,08 | carta de serviço do Governo de SP, base Lei 15.266/2013 |
| RS | 98 → **114** | 114,09 (código 7714) | Portaria DETRAN/RS 036/2026 |
| RJ | 231 | não confirmado | a tabela de DUDAs do DETRAN-RJ publica transferência e 2ª via, não o licenciamento anual |

Vale R$ 0,59/mês em SP e R$ 1,34/mês no RS. Corrigido porque é barato, mas não
priorize acima de seguro ou depreciação.

Padrão de manutenção: SP indexa à UFESP, RS à UPF/RS, RJ à UFIR-RJ, e todos
republicam portaria em janeiro. **Os 27 números apodrecem em bloco todo começo
de ano.** Se forem para o Firestore, guarde `{valor, unidadeFiscal, exercicio,
sourceUrl, updatedAt}` e trate janeiro como janela de recoleta.

**Método que vale reaproveitar:** várias SEFAZ mantêm bases Lotus Notes de
legislação tributária em subdomínios `app1.*` / `www5.*`. Foi uma delas que
entregou a alíquota do MT. Valem mais que o portal bonito da SEFAZ, que costuma
ser SPA e redirecionar para a home.

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

### Contradição interna, fechada em 14/08/2026

Terceiros tinha piso absoluto (`clamp(value * 0.015, 700, 2200)`); completo
tinha piso **relativo** (`value * 0.025`), que vai a zero junto com o valor do
carro. Resultado medido no próprio motor: abaixo de ~R$ 11.250 de FIPE o modelo
dizia que **cobertura completa custava menos que só terceiros**. Completo contém
terceiros — não era calibragem ruim, era impossibilidade lógica, e bem na faixa
de preço que o público do Engine compra. Agora o prêmio de terceiros é o piso do
completo.

**Isso não resolve o piso de verdade.** Prêmio real tem componente que não
escala com o FIPE: RCF (limites em R$ fixos, precificados pelo risco do
condutor), assistência 24h e carro reserva (custo fixo de serviço), emissão de
apólice, e IOF de 7,38% por cima. Como % → 0 quando o valor → 0, a fórmula
continua errada no limite. A ordem de grandeza do piso é R$ 1.200 a R$ 1.800/ano
— **estimativa, não fonte**: a CNseg publica prêmio médio agregado só em
matéria de imprensa, e o resto que circula é conteúdo comercial de quem vende
seguro. Não entrou no código por isso.

### O problema que ninguém tinha levantado: casco em carro velho não existe

O teto prático de aceitação das seguradoras tradicionais é 15 a 20 anos, e
várias param em 15 (a MAPFRE tem FAQ própria sobre isso). Acima disso sobram
Suhai (só roubo/furto), proteção veicular associativa — que **não é seguro** e
não é regulada pela SUSEP — ou nada.

O motor trata carro velho como **20% de desconto** (`carAgeFactor = 0.85` acima
de 10 anos) e nunca como produto indisponível. Para um carro de 18 ou 20 anos
ele cospe um prêmio de completo confiante para uma apólice que não está à
venda. Não é subestimar um número, é responder a pergunta errada. **Em aberto.**

### AUTOSEG pode ter voltado — reverificar de outra rede

A SUSEP publicou notícia em jun/2024 dizendo que a base de automóvel foi
reaberta em caráter permanente no PDA 2024-2026, e existe página de conjunto no
`dados.gov.br`. Isso contradiz o "congelado em 2020" registrado abaixo. Não deu
para confirmar: `www2.susep.gov.br` ficou inalcançável (falha de conexão, não
404) nas tentativas de 14/08/2026, e o `dados.gov.br` **agora exige chave de
API** (401) — era aberto no levantamento de 11/08.

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

## 6. Consumo — dead end no Brasil, e uma base rotulada errado

INMETRO/PBE Veicular só publica **PDF**. Nenhum CSV, nenhuma API. 794 modelos no
ciclo 2026. Licença CC Atribuição-**SemDerivações**, o que é uma questão
jurídica real se formos redistribuir tabela derivada.

### `fipe-consumption-db.json` NÃO é do INMETRO (auditado em 14/08/2026)

A base embutida no bundle era anunciada na tela como "Consumo real INMETRO" e no
cabeçalho do `consumption.js` como "do INMETRO". O próprio arquivo desmente:

- **91 modelos compartilham só 24 tuplas distintas.** Corolla, Focus, T-Cross,
  C4 Cactus, 408, Captur, Yuan, H2 e um Mercedes C180 têm exatamente o mesmo
  consumo. São faixas por categoria, não medições.
- **Todo modelo tem valor de diesel**, inclusive Gol, Uno, Palio, Kwid, Onix,
  Mobi e Prius — que não existem em versão diesel no Brasil.
- O JSON **não declara fonte nenhuma**: só `compiledAt`, `version` e
  `coverage: "100.0%"`.

Consistente com o parágrafo acima: se o INMETRO só publica PDF, esta base não
veio de lá.

Isso importa muito mais que o erro numérico, porque o consumo decide ~2/3 da
conta na tela. A base continua em uso — estimativa por categoria ainda separa um
Hilux de um Mobi, o que a média única não faz —, mas a tela e o código agora
chamam pelo nome. **Substituir por medição real segue em aberto**, e é
provavelmente caso para o `expenses.js`, igual à manutenção.

(Um argumento que NÃO serve como prova: a razão etanol/gasolina ficar em ~0,72
em todos os modelos. Isso é física — o etanol tem ~30% menos energia por litro —
e apareceria igual numa base real.)

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
