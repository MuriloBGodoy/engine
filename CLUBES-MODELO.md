# Clubes do Engine — modelo de crew

Proposta de modelo, 19/09/2026. Só pesquisa e desenho: nenhum código nesta
rodada. A Jesse desenha a página a partir daqui; quem portar a camada de dados
usa a seção 7.

Ponto de partida (lido em `engine/src/components/clubs/*`, `services/clubs.js`,
`pages/ClubDetailPage.jsx`): clube hoje é nome + descrição + 4 categorias em
inglês + público/privado + 5 tags + 1 imagem; card com imagem/categoria/nome/
contagens; página = feed + membros. Sem papéis, região, marca, estilo, eventos,
garagem. E `services/clubs.js` só fala com o backend Java (`clubsRequest`), que
em produção não existe — **Clubes está morto no site publicado**.

---

## 1. O que um clube É

**Um clube do Engine é uma crew: um grupo com emblema, sigla e cor, unido por um
carro, uma marca ou um estilo, com uma cidade-base, os carros dos membros à
vista e uma agenda de encontros.**

O que ele NÃO é:

- **Não é grupo de Facebook.** Grupo é um mural com capa. Crew tem identidade
  que o membro carrega (a sigla ao lado do nome, o emblema no perfil), não só
  um lugar onde se posta.
- **Não é fórum nem chat.** Conversa é meio, não fim. O que segura a pessoa é
  ver o próprio carro na garagem do clube e o próximo encontro na agenda.
- **Não é ranking de quem gasta mais.** Rivalidade é sobre presença (quem leva
  mais carro pro encontro), nunca sobre dinheiro ou "cavalo declarado" — o
  mesmo princípio que derrubou o `consumption.js` falso vale aqui.
- **Não é uma quinta feature.** É o lugar onde garagem, eventos, região, perfil
  e conquistas se encontram. Se o clube precisar de uma peça que já existe,
  reusa; se precisar de uma coleção paralela pra mesma coisa, o modelo está
  errado.

Referências que sustentam a frase (detalhe na seção 9):

- **Identidade que o membro carrega** vem das crews de jogo: GTA Online — tag
  de quatro letras que segue o nome do jogador no lobby, emblema, lema,
  cinco cargos. Não existe equivalente em Strava nem Facebook, e é o que o
  Murilo chamou de "meio Velozes e Furiosos".
- **Cidade-base, "desde 19xx", encontro mensal** vem de como os clubes reais
  brasileiros se apresentam: "Desde 1972 fazendo história" (Civic Club
  Brasil), "fundado em 12 de setembro de 2004… encontro no primeiro domingo
  de cada mês na Praça José Affonso Junqueira" (FuscaPoços), diretórios da VW
  e do Eventos VW listam cada clube com **logo, cidade/UF, ano de fundação e
  contato**, agrupados **por estado**.
- **Carros dos membros como vitrine** vem dos apps de crew que já existem lá
  fora (Revv Social: "showcase your members and their builds"; Carvonix: crew +
  garagem virtual + drives). É o único ponto em que o Engine já tem vantagem:
  a garagem existe, com ficha por versão.
- **Papéis e eventos de clube** vem do Strava (owner intransferível até
  transferir, admins aprovam pedidos, só owner/admin cria evento do clube).

---

## 2. O modelo, campo por campo

Convenção: `campo` em inglês (identificador), rótulo em pt-BR (o que a tela
mostra; vai pro i18n nos 3 idiomas). Tamanhos são limites de validação no
`normalizeClub`, não sugestão de UI.

### 2.1 Identidade

| campo | rótulo | tipo / limite | obrigatório | notas |
|---|---|---|---|---|
| `name` | Nome | 3–40 chars | sim | Hoje é 120. Nome de clube real é curto: "Civic Club Brasil", "FuscaPoços", "Air Cooled BH", "Mundo dos GTIs". 40 cabe no card sem truncar. |
| `tag` | Sigla | 2–5 chars, `[A-Z0-9]`, **única no app** | sim | A peça que mais faz o clube parecer crew. GTA usa 4 letras maiúsculas. Aparece como `[CVC]` ao lado do nome do membro no mural do clube e (opt-in) no perfil. Unicidade via registro `clubTags/{tag}`, mesmo mecanismo de `usernames/`. |
| `emblem` | Emblema | ver abaixo | sim (gerado) | Quadrado. **Padrão = brasão gerado** (forma + cor + sigla), sem upload. Upload é fase 2. |
| `cover` | Capa | imagem 16:9 | não | Sem capa, a página usa gradiente das cores do clube. |
| `colors` | Cores | `{ primary, secondary }` de **paleta fechada** | sim | Ver 2.1.1. |
| `motto` | Lema | ≤ 60 chars | não | "Lugar de mola é no lixo" (Rebaixados Club#). Fica embaixo do nome, em itálico ou caixa alta — decisão da Jesse. |
| `description` | Sobre | ≤ 500 chars | não | Texto livre. |
| `country` / `state` / `city` | Cidade-base | códigos de `services/locations.js` (`BR`/`SP`) + cidade texto | país e estado sim; cidade não | Mesmo eixo da pílula de região. "Brasil inteiro" = estado vazio. |
| `foundedYear` | Fundado em | inteiro, 1950..ano atual | não | Pode ser **anterior ao Engine** — Civic Club Brasil "desde 1972", Fusca Clube do Brasil 1985, FuscaPoços 2004. Só ano; mês não agrega. |
| `meetupSchedule` | Encontro fixo | ≤ 80 chars, texto | não | "1º domingo do mês, Praça José Affonso Junqueira". É texto, não automação: o padrão real dos clubes é um encontro recorrente no mesmo lugar, e a feature de Eventos cobre o evento datado. |

#### 2.1.1 Emblema gerado e paleta

Por que gerado e não upload: Firebase Storage ainda não está ligado (Blaze
adiado, ver memória `engine-prelancamento`), as imagens do app hoje são base64
dentro do documento, e emblema desenhado por usuário sem ferramenta sai ruim
na maioria dos casos — o próprio GTA precisou construir um editor de emblemas
inteiro. Brasão gerado dá identidade forte a custo zero e fica consistente na
grade de descoberta.

Parâmetros do emblema (gravados no doc, renderizados como SVG no cliente):

- `emblem.shape`: `shield` | `circle` | `hex` | `badge` (4 formas)
- `emblem.icon`: lista fechada de ~12 ícones do vocabulário da cena
  (roda, turbo, pistão, chave, bandeira quadriculada, raio, montanha,
  velocímetro, chassi baixo, farol, escudo vazio, sem ícone)
- `emblem.text`: a `tag` (sempre; é o que torna cada emblema único)
- cores: herdam de `colors`

Paleta (`colors.primary` / `colors.secondary`): 16 cores nomeadas, escolhidas
pela Jesse pra funcionar em claro e escuro sobre `--engine-surface`. Hex livre
fica pra depois; hoje a chance de cor ilegível é maior que o ganho. O nome da
cor vai gravado (`"vermelho-corrida"`), o hex mora no tema.

Cor é o que a página inteira do clube herda: faixa do card, fundo da capa sem
imagem, chip da sigla, botão "Entrar". É assim que dois clubes com a mesma
estrutura parecem lugares diferentes.

### 2.2 O que une (`focus`)

Três eixos opcionais e combináveis; pelo menos um obrigatório. Isso resolve o
"um pouco de tudo": Civic de Campinas = modelo + cidade; galera dos rebaixados
= estilo + cidade; Honda Clube Brasil = marca + país.

| campo | rótulo | tipo / limite | fonte do vocabulário |
|---|---|---|---|
| `focus.brands[]` | Marcas | ≤ 3, strings da FIPE | Exatamente o `car.brand` que a Garagem grava (é vocabulário controlado da FIPE, não texto livre — ver memória `brian-garage-agent`). Casa por igualdade. |
| `focus.models[]` | Modelos | ≤ 3, **família** de modelo | O `car.model` da FIPE é a versão longa (`ONIX HATCH LT 1.0 12V Flex 5p Mec.`). A família é o primeiro token (`ONIX`, `CIVIC`, `GOLF`). **Inferência minha, a confirmar com o Brian:** o primeiro token da string FIPE identifica a família em quase todos os casos; exceções conhecidas são nomes compostos (`GRAND SIENA`, `NEW FIESTA`) que precisam de uma lista de exceções. Até confirmar, o formulário oferece família a partir das marcas escolhidas via `fipeService` (lista de modelos → primeiro token, dedup). |
| `focus.styles[]` | Estilos | ≤ 3, lista fechada abaixo | Declarado pelo fundador; não se infere da ficha. |

**Lista fechada de estilos** (id → rótulo pt-BR; en/es no i18n). Marcação de
origem: **[cena]** = nome usado por evento/página real encontrada na pesquisa;
**[inferido]** = nome corrente que eu não achei em fonte citável nesta rodada.

| id | rótulo pt-BR | origem |
|---|---|---|
| `rebaixados` | Rebaixados (fixa, rosca, ar) | [cena] — Encontro de Tupã premia "fixa, rosca, ar"; Expobaixos "maior encontro de rebaixados do Brasil" |
| `som` | Som automotivo | [cena] — Insane Sound/Barretos: "som automotivo, tuning e carros rebaixados" |
| `tuning` | Tuning | [cena] — idem |
| `antigos` | Antigos e clássicos | [cena] — "Clube do Carro Antigo de Londrina", "Encontro Mensal de Carros Antigos MG" |
| `ar` | VW a ar | [cena] — "Air Cooled BH — VWs a Ar", FuscaPoços "derivados com motor a ar" |
| `jdm` | JDM | [inferido] — Civic Club Brasil usa o emblema 🔰 (shoshinsha, marca JDM), mas a palavra não apareceu em bio citável |
| `euro` | Euro (VW, BMW, Audi) | [inferido] — "Mundo dos GTIs" é o exemplo, sem o rótulo |
| `muscle` | Muscle e americanos | [inferido] |
| `esportivos` | Esportivos e hot hatch | [inferido] — "Mundo dos GTIs: aficcionados pelos esportivos" |
| `preparados` | Turbo e preparados | [inferido] — vocabulário de arrancada; não achei bio citável |
| `offroad` | Off-road e 4x4 | [inferido] |
| `picapes` | Picapes | [inferido] — VW lista clube de Amarok |
| `suv` | SUVs | herdado da lista atual |
| `eletricos` | Elétricos e híbridos | herdado da lista atual (`Hybrids`) |
| `drift` | Drift | herdado de `eventTypes.js` |
| `track` | Track day | herdado de `eventTypes.js` |
| `viagem` | Road trip e viagem | [inferido] — Carvonix vende "GPS-guided drive tours" |

Dezessete é muito pra um select; a Jesse decide se vira grade de chips com
ícone. A lista é um `clubStyles.js` (mesmo padrão de `eventTypes.js`: só
valores; rótulo sai do i18n). As 4 categorias em inglês de hoje somem.

**Como isso conversa com a ficha do Brian:**

- Marca e família casam com `brand`/`model` do carro sem parser: é igualdade
  de string do vocabulário FIPE. Um membro com Civic na garagem vê "3 clubes
  pro seu carro" na descoberta (seção 5).
- `eletricos` pode ser sugerido pelo carro: o parser `fipeVersion.js` lê
  combustível em 100% das versões.
- `picapes`/`suv` **não** se inferem com segurança do nome FIPE (não há token
  de carroceria confiável); ficam declarados.
- Nada do clube escreve na ficha, e a ficha nunca decide a que clube o carro
  "pertence". O clube só filtra e sugere.

### 2.3 Regras e links

| campo | rótulo | tipo / limite | visibilidade |
|---|---|---|---|
| `rules[]` | Regras do clube | ≤ 5 itens × 120 chars | pública |
| `links.instagram` | Instagram | handle sem `@` | pública |
| `links.whatsapp` | Grupo do WhatsApp | URL `chat.whatsapp.com/…` | **só membro** |
| `links.facebook` | Grupo do Facebook | URL | pública |
| `links.website` | Site | URL | pública |

Regras é o padrão dos grupos do Facebook (admin cria/edita regras, ≤ 10 lá; 5
aqui basta). WhatsApp só pra membro é proteção contra spam: link aberto em
página pública é convite pra bot. Os eventos já têm `communityLinks.
{whatsappGroup, facebookGroup}` — evento criado pelo clube pré-preenche com os
links do clube.

### 2.4 Papéis

Três papéis na fase 1. GTA tem cinco (Leader, Commissioner, Lieutenant,
Representative, Muscle) e o Strava dois (owner, admin); pra um clube de 5 a 50
pessoas, três é o máximo que não vira burocracia.

| papel | rótulo | quantos | pode |
|---|---|---|---|
| `founder` | Fundador | exatamente 1 | tudo do capitão + editar identidade (nome, sigla, cores, emblema) + promover/rebaixar capitão + transferir fundação + arquivar o clube. **Não pode sair sem transferir** (regra do Strava: owner só sai depois de passar o bastão). |
| `captain` | Capitão | N | aprovar/recusar pedidos, convidar, remover membro, criar/editar evento do clube, fixar post no mural, apagar post alheio no mural, editar sobre/regras/links/encontro fixo. |
| `member` | Membro | N | postar no mural, expor carro na garagem do clube, confirmar presença nos encontros, sair. |

Fase 2: `title` livre por membro (≤ 20 chars, "Piloto", "Fotógrafo", "Tesoureiro"),
puramente cosmético, como os cargos coloridos do Discord — decoração, sem
permissão. A diretoria dos clubes reais (FuscaPoços tem "Diretoria do Clube")
é isso: nome de cargo, não permissão de sistema.

### 2.5 Visibilidade

Dois campos independentes, porque "quem entra" e "quem vê" são perguntas
diferentes:

- `joinPolicy`: `open` (entra na hora) | `approval` (pede, capitão aprova) |
  `invite` (só por convite; fase 2).
- `contentVisibility`: `public` (mural, garagem e membros abertos) |
  `members` (só o "sobre" e a garagem são públicos; mural, lista de membros
  e WhatsApp exigem ser membro).

O card do clube é **sempre** público, inclusive de clube fechado — descoberta
precisa dele, e é o que o Strava faz (clube invite-only aparece, esconde só
atividade e discussão). A garagem é sempre pública porque é a vitrine que faz
alguém querer entrar.

### 2.6 O que aparece no card e o que aparece na página

**Card** (grade de descoberta e "meus clubes"):

1. emblema (grande, canto) + faixa na `colors.primary`
2. `[TAG]` + nome
3. cidade/UF (ou "Brasil")
4. até 2 chips de foco: 1 marca/modelo + 1 estilo
5. membros · carros na garagem · **próximo encontro** (data, se houver)
6. botão: Entrar / Pedir pra entrar / Membro

**Página** (`/clubs/:id`):

- **Cabeçalho**: capa (ou gradiente das cores), emblema sobreposto, `[TAG]`
  nome, lema, linha "desde 2004 · Poços de Caldas/MG · 1º domingo do mês",
  chips de foco, CTA de entrada, 3 números (membros, carros, encontros
  realizados).
- **Abas**: Mural · Garagem · Encontros · Membros · Sobre.
  - Mural: posts do clube (mesmo `GoalCard` da Comunidade) + post fixado.
  - Garagem: grade dos carros dos membros (seção 3).
  - Encontros: próximos + passados, com RSVP da feature de Eventos (seção 4).
  - Membros: fundador e capitães primeiro, com o carro principal de cada um.
  - Sobre: descrição, regras, links, fundação.
- **Painel do capitão** (só pra `captain`/`founder`): pedidos pendentes,
  convidar, editar.

Regra de ouro pra Jesse: **o membro precisa ver o carro dele na página do
clube em menos de um scroll**. É o que transforma "entrei num grupo" em "sou
da crew".

---

## 3. A garagem do clube

**Fato que muda o desenho:** `users/{uid}/cars/{carId}` é privado por regra
(`allow read, write: if isOwner(userId)`). Ninguém além do dono lê a garagem.
A única representação pública de um carro é a **meta publicada na
Comunidade**: `communityGoals/{goalId}` com `kind: "goal"`, `ownerId`,
`carId`, `brand`, `model`, `year`, `image`, `images`, `specs`
(`communityCarPatch` em `db.js`). O dono já escolhe o que expõe quando publica
— inclusive a decisão registrada de que o perfil só mostra metas publicadas
("garagem tem carro que a pessoa pode não querer expor").

Então a garagem do clube **não duplica dado nem cria carro novo**: ela lê
`communityGoals`.

**Fase 1 — automática, sem escrita nova:** garagem do clube = metas publicadas
(`kind == "goal"`) cujo `ownerId` está na lista de membros. Consulta
`where("ownerId", "in", [uids])` em lotes de 30 (limite do `in`), ordenada no
cliente: primeiro os carros que casam com o `focus` do clube (marca/família),
depois o resto. Um clube de 50 membros = 2 consultas. Sem doc novo, sem
contador, sem regra nova. Custo: imagens base64 vêm junto; paginar a grade em
12 e carregar o resto sob demanda.

**Fase 2 — escolha do membro:** `clubs/{id}/garage/{uid}` (um doc por membro,
id = uid, regra da casa), corpo `{ uid, goalIds: [≤ 3], updatedAt }`. Só o
próprio uid escreve. Serve para (a) escolher qual carro representa a pessoa no
clube quando ela tem vários, (b) contar "carros na garagem" com
`getCountFromServer` sem ler os goals, (c) ordenar a grade por escolha do
membro. O card do carro continua lendo `communityGoals/{goalId}` — o doc de
garagem guarda só ids, nunca imagem.

O que fica explícito na UI: se o membro não tem meta publicada, a garagem
mostra o avatar dele com "publique seu carro na Comunidade pra ele aparecer
aqui". Isso é aquisição pra Comunidade de graça.

Cuidado herdado do Brian: números da ficha na grade do clube só aparecem com
a etiqueta de origem que `publicSpecSheet` já emite. Garagem de clube sem
isso vira "placar de cavalo inventado".

---

## 4. Eventos do clube

A feature existe (`services/events.js`, `events/{id}/participants/{uid}`,
regra pronta, tipos em `eventTypes.js`). O clube liga nela por **um campo**:

- `events.clubId` (string, opcional) + `clubTag` e `clubName` desnormalizados
  para o card do evento mostrar `[CVC] Civic Campinas` sem ler o clube.
- Criar evento a partir da página do clube pré-preenche `state`, `country`,
  `location` (cidade-base), `communityLinks` (links do clube) e `clubId`.
- **Quem pode**: `captain` e `founder` (Strava: só owner/admin cria evento do
  clube). Regra: `create` com `clubId` exige `get(clubs/$(clubId)/members/
  $(uid)).data.role in ["founder","captain"]` — um `get` extra por criação,
  aceitável.
- **Onde aparece**: nas duas telas. Aba Encontros do clube = `where clubId ==
  id` ordenado por `eventDate` (índice composto `clubId + eventDate`). Aba
  Eventos geral continua listando tudo, com o chip do clube no card — evento
  de clube é público como qualquer outro, a não ser que o capitão marque
  `membersOnly: true` (fase 2; hoje a regra de leitura de evento é `true` e
  mudar isso é decisão à parte).
- **"Encontros realizados"** no cabeçalho = `getCountFromServer` em `events`
  com `clubId == id && eventDate < hoje`. Agregação com filtro, sem ler docs.
- **Presença por clube**: `events/{id}/participants/{uid}` já existe. Cruzar
  participantes com membros do clube dá "quantos do clube foram" — dado
  verificável que a seção 6 usa.
- Encontro fixo (`meetupSchedule`, texto) e evento datado convivem: o texto
  diz "todo 1º domingo", o evento datado é o que tem RSVP. O capitão cria o
  evento do mês com um clique "criar o próximo encontro fixo" (fase 2).

O que **não** fazer: subcoleção `clubs/{id}/events`. Seria segunda coleção de
evento, com segunda regra e segundo RSVP — exatamente o erro que o feed
evitou ao pôr meta e post na mesma coleção.

---

## 5. Descoberta

Ordem dos filtros, do que mais importa pro que menos:

1. **Região** (país/estado da pílula, `useRegion()`), com a cascata e a
   proteção anti-tela-vazia de `applyRegionFilter` (memória
   `engine-regiao-localidade`): se o filtro zerar, mostra tudo e avisa
   "ampliamos pra todo o Brasil". Clube sem estado (nacional) **nunca** é
   escondido — `matchesRegion` já é leniente com localização desconhecida.
2. **Estilo** (chips, um por vez) e **marca** (select) — filtros de servidor
   (`array-contains`; só um por consulta, então estilo e marca são alternados,
   não combinados, na fase 1).
3. **Busca** por nome ou sigla: prefixo em `nameLower` e igualdade em `tag`.

**Seções da tela de descoberta** (sugestão de ordem):

- **Pro seu carro** — clubes cujo `focus.brands`/`focus.models` casa com os
  carros do usuário logado. Consulta por `array-contains` na marca de cada
  carro (≤ 3 consultas). É o gancho mais forte que temos e nenhum concorrente
  pesquisado faz isso a partir de uma garagem com vocabulário FIPE.
- **Perto de você** — região.
- **Em alta** — ver definição abaixo.
- **Todos** — grade paginada.

**"Em alta" significa**, na fase 1, uma coisa só e verificável: **clubes com
encontro marcado nos próximos 30 dias**, ordenados pelo mais próximo,
desempate por `memberCount`. Não é "engajamento" nem "posts" — um clube com
encontro marcado está vivo por definição, e o dado vem de `events`, que
ninguém precisa forjar. Fase 2 pode somar membros novos nos últimos 30 dias
(`joinedAt` na subcoleção, `getCountFromServer` com filtro).

**Como não ficar com tela vazia no começo** (o "muito poucos clubes"):

1. **Clubes oficiais do Engine**, criados pelo Murilo no dia 1: um por
   estilo, nacionais, `[ENG-RBX]`-style, com emblema gerado e cores
   diferentes. Dez clubes de saída já enchem a grade e, mais importante,
   **ensinam pelo exemplo** o que um clube bem preenchido é. Marcados
   `official: true` (só `isServiceAdmin` grava) pra ganhar um selo e ficar no
   fim do ranking regional (não competem com clube de gente).
2. **CTA "Fundar um clube"** com destaque quando a região filtrada tem menos
   de 3 clubes: "Ainda não tem clube de Rebaixados em Goiás. Funde o
   primeiro." — o texto nasce do próprio filtro vazio.
3. **Alargamento automático** da região (já existe) antes de mostrar vazio.
4. **Sugestão na Garagem**: no card do carro, "3 clubes pro seu Civic" quando
   existir casamento de foco — leva gente pra descoberta a partir do lugar
   onde ela já está.

---

## 6. Rivalidade e ranking entre clubes

Princípio: **só rankear o que se conta numa subcoleção que ninguém forja**, e
só o que celebra presença, não gasto. É o que impede virar tóxico ou fake.

| métrica | fonte verificável | fase |
|---|---|---|
| Membros | `getCountFromServer(clubs/{id}/members)` | 1 |
| Encontros realizados | count em `events` com `clubId` e data passada | 1 |
| Presença total | soma de `participants` dos eventos do clube (N counts) | 2 |
| Carros na garagem | count em `clubs/{id}/garage` | 2 |
| Membros novos (30 dias) | count em `members` com `joinedAt >= …` | 2 |

**O que NÃO entra no ranking, e por quê:**

- **km rodado.** Existe (`odometer` nos lançamentos de combustível, em
  `expenses.js`), mas mora em `users/{uid}/cars`, privado, só pra carro
  `owned` com abastecimento lançado, e só o dono consegue publicar — ou seja,
  é auto-declarado, não verificável, e recompensa quem inventa. Se um dia
  entrar, entra como **opt-in cosmético** ("km do clube este mês", contribuição
  voluntária escrita pelo próprio membro no doc de garagem dele), fora de
  qualquer ranking competitivo. Fase 3, e só se alguém pedir.
- **Cavalo, 0-100, valor do carro.** Mesma razão; e a ficha declarada já
  carrega etiqueta de "afirmação do dono" justamente pra não virar placar.
- **Curtidas do mural.** Contador de vitrine, passo ±1, inflável um a um.

**Escopo do ranking**: sempre **por estado e por estilo** ("Top 5 Rebaixados
em SP"), nunca um ranking nacional único. Ranking único coroa o maior e
desanima os outros; ranking por recorte dá a cada clube uma disputa em que ele
tem chance. É a lição do Strava: leaderboard semanal, top 10, reset toda
semana — a disputa recomeça.

**"Clube da semana"**: fase 1 é **editorial**, um doc `featured/clubOfWeek`
que só `isServiceAdmin` escreve, com `clubId` e uma frase. Custa zero e é o que
o Murilo faria à mão de qualquer jeito nos primeiros meses. Automático (maior
presença em encontro na semana) é fase 3, quando houver volume pra escolher.

**Desafio entre clubes** (fase 3, o "a gente contra o mundo" de verdade):
dois clubes marcam presença no **mesmo evento** (ex.: Expobaixos); o placar é
"quantos de cada clube confirmaram", cruzando `participants` com `members`.
Verificável, saudável, e o resultado é gente indo pro encontro. Sem votação,
sem "melhor carro" — isso fica pra premiação do evento físico, que já existe
na cena (Tupã premia fixa/rosca/ar; Insane Sound tem troféu de 1º a 3º).

**Conquistas de clube**: mesmo modelo das conquistas de usuário (memória
`engine-conquistas`): `clubs/{id}/achievements/{marco}`, existir é ter
conquistado, lista fechada na regra, corpo só `unlockedAt`, detecção no
cliente de quem praticou a ação, contando subcoleção. Marcos iniciais:
`founded`, `members_10`, `members_50`, `first_meetup`, `meetups_10`,
`garage_10`. Aparecem no cabeçalho como medalhas. Fase 2.

---

## 7. Estrutura no Firestore

Cabe nas regras da casa: lista de gente = subcoleção com uid no id; contador
de vitrine ≠ contagem real; sem `collectionGroup` em nada novo.

### 7.1 Coleções e documentos

```
clubs/{clubId}
  name, nameLower, tag, motto, description
  emblem { shape, icon }            // text = tag; cores = colors
  colors { primary, secondary }     // nomes da paleta
  cover                              // base64 comprimido ou ""
  country, state, city, foundedYear, meetupSchedule
  focus { brands[], models[], styles[] }
  rules[], links { instagram, whatsapp, facebook, website }
  joinPolicy: open|approval|invite
  contentVisibility: public|members
  founderId
  memberCount                        // VITRINE, passo ±1 na regra
  official: bool                     // só isServiceAdmin
  archived: bool                     // no lugar de delete
  createdAt, updatedAt

clubs/{clubId}/members/{uid}
  uid, role: founder|captain|member, joinedAt
  displayName, username, avatar      // desnormalizado pra lista (como followers)
  title                              // fase 2, cosmético

clubs/{clubId}/requests/{uid}        // joinPolicy = approval
  uid, message, createdAt

clubs/{clubId}/invites/{uid}         // joinPolicy = invite (fase 2)
  uid, invitedBy, createdAt

clubs/{clubId}/garage/{uid}          // fase 2
  uid, goalIds[], updatedAt

clubs/{clubId}/achievements/{marco}  // fase 2
  unlockedAt

clubTags/{TAG}                        // unicidade da sigla
  clubId

users/{uid}/clubs/{clubId}           // espelho: "meus clubes" sem collectionGroup
  role, joinedAt, tag, name          // escrito pelo próprio uid, no mesmo batch

featured/clubOfWeek                  // editorial
  clubId, blurb, weekOf

events.{clubId, clubTag, clubName}   // campos NOVOS em events (opcionais)
communityGoals.{clubId, clubTag}     // campos NOVOS em communityGoals (opcionais)
```

**Mural = `communityGoals` com `clubId`.** Post no clube é um post da
Comunidade (`kind: "post"`) carimbado com o clube. Ganha de graça: `GoalCard`,
curtida em subcoleção, comentário, denúncia, bloqueio, regra de interação e
os marcos de conquista. Aparece no feed geral com o chip `[CVC]` — cada post é
propaganda do clube. Mural = `where clubId == id orderBy createdAt desc`.
`contentVisibility: members` no mural exige mudar a regra de leitura de
`communityGoals` (hoje `true`) pra uma condição que dependa de
`resource.data.clubId` + `get()` do membro; funciona em consulta filtrada por
`clubId`, mas é uma regra a mais num lugar que já é delicado. **Fase 1: mural
sempre público; `members` restringe só lista de membros e WhatsApp.**

**Por que espelho em `users/{uid}/clubs` e não `collectionGroup("members")`:**
é o mesmo motivo do par `followers`/`following`. Consulta de grupo não passa
pela regra aninhada, precisa de `match /{path=**}/members/{uid}` só de leitura
e de índice `COLLECTION_GROUP` — e o `firestore.indexes.json` **já tem um
override de `members.userId` em escopo COLLECTION_GROUP**, sobra do plano
Java. Se o espelho for adotado, esse override sai, pra não ficar uma porta
aberta sem uso. O espelho custa um doc a mais por entrada, escrito pelo
próprio usuário no batch de entrada/saída.

### 7.2 Contadores: vitrine vs real

| número | vitrine (no doc do clube) | real (agregação) | quem usa qual |
|---|---|---|---|
| membros | `memberCount`, regra prende passo em ±1 | `getCountFromServer(members)` | grade e card usam vitrine; ranking, marco e cabeçalho da página usam real |
| encontros realizados | não existe | count em `events` filtrado | página |
| carros | não existe (fase 1) | count em `garage` (fase 2) | página |
| posts | **some**: `postCount` de hoje não tem quem o mantenha honesto | count em `communityGoals` filtrado por `clubId`, se a tela pedir | — |

### 7.3 Regras — o que precisa existir

Em prosa; o código vem na rodada de implementação.

- `clubs/{id}`: read `true` (card é público; `archived` filtra no cliente e
  na consulta). create: logado, `founderId == uid`, `memberCount == 1`, `tag`
  no formato, `official == false` salvo admin. update: fundador edita tudo;
  capitão edita só `description|rules|links|meetupSchedule|cover|updatedAt`
  (`affectedKeys().hasOnly`); qualquer logado só `memberCount ±1` +
  `updatedAt` (é a escrita de vitrine ao entrar/sair). delete: `false`
  (arquiva). `official` e `founderId` só mudam via admin / transferência.
- `clubs/{id}/members/{uid}`: read `true` se `contentVisibility == public`,
  senão membro (um `get` do próprio doc de membro). create: (a) o próprio uid
  com `role == member` se `joinPolicy == open`; (b) o próprio uid se existe
  `requests/{uid}` aprovado ou `invites/{uid}` (`exists()`); (c) capitão/
  fundador criando o doc de outro uid ao aprovar. update: só `role`, por
  fundador (qualquer) ou capitão (só `member`→`captain`? não — só fundador
  promove; capitão não mexe em cargo — mantém 3 papéis simples). delete: o
  próprio uid (sair; fundador não pode) ou capitão/fundador (remover).
- `clubs/{id}/requests/{uid}`: create pelo próprio uid; read/delete pelo
  próprio uid ou capitão/fundador.
- `clubTags/{tag}`: read logado; create logado se `clubId` aponta pra clube
  cujo `founderId == uid` (via `getAfter`, mesmo batch da criação); update
  `false`; delete só admin. Sigla não muda depois de criada na fase 1 — mudar
  sigla é mudar identidade e é raro; se precisar, vira função de admin.
- `users/{uid}/clubs/{clubId}`: read/write só `isOwner(uid)`.
- `events`: create com `clubId` exige cargo (um `get`); sem `clubId`, regra
  atual.
- `communityGoals`: create com `clubId` exige membro (um `get`). Interação
  não muda.
- `featured/{doc}`: read `true`, write admin.
- Testes obrigatórios (memórias `engine-mobile-view` e `subcolecao`): segundo
  usuário não-admin, e escrita com valor que **muda** (no-op passa qualquer
  regra).

### 7.4 Índices compostos necessários

| coleção | campos | consulta |
|---|---|---|
| `clubs` | `archived asc, country asc, state asc, memberCount desc` | perto de você |
| `clubs` | `archived asc, focus.styles array-contains, memberCount desc` | por estilo |
| `clubs` | `archived asc, focus.brands array-contains, memberCount desc` | por marca / "pro seu carro" |
| `clubs` | `archived asc, nameLower asc` | busca por prefixo |
| `events` | `clubId asc, eventDate asc` | aba Encontros, "em alta", contagem de realizados |
| `communityGoals` | `clubId asc, createdAt desc` | mural |
| `communityGoals` | `kind asc, ownerId asc` (se o `in` precisar) | garagem fase 1 |

Só um `array-contains` por consulta: estilo e marca não se combinam no
servidor na fase 1. `focus.models` sem índice até alguém filtrar por modelo.

Nenhum `COLLECTION_GROUP` novo. O override existente de `members.userId` sai.

### 7.5 Limites conhecidos

- Apagar clube não apaga subcoleções (sem Cloud Function no Spark). Por isso
  `archived` em vez de delete — mesmo limite já documentado em `events`.
- Emblema/capa em base64 dentro do doc: capa comprimida ≤ 60 KB via
  `imageCompression.js`. Emblema gerado não ocupa nada. Quando Storage
  ligar, os dois migram pra URL.
- Chat de grupo do clube **não existe**: `conversations` tem regra
  `memberIds.size() == 2`. "DM em grupo" hoje não é verdade no Firestore; chat
  de clube é feature nova, fase 3, e Revv Social mostra que ela importa.

---

## 8. Fases

Estimativas em dias de desenvolvimento focado, sem a parte visual da Jesse
(que corre em paralelo). A referência de calibração: o plano de 31/07 previa
5 dias pro CRUD Java e entregou — mas em cima de um backend que não existe em
produção. Desta vez não há backend: é Firestore direto, e a regra é metade do
trabalho.

### Fase 1 — o mínimo que já parece crew (≈ 7–8 dias)

O que entra, e por que cada item é indispensável:

| item | por quê | esforço |
|---|---|---|
| Port de `services/clubs.js` pra Firestore: `clubs`, `members`, `requests`, `clubTags`, espelho `users/{uid}/clubs` | hoje está morto em produção | 2 d |
| Regras + testes com segundo usuário e valor que muda; índices | rules first | 1,5 d |
| Formulário novo: nome, **sigla**, **emblema gerado**, **cores**, cidade/UF, fundado em, lema, foco (1 estilo + marca/modelo opcional), joinPolicy open/approval, links, regras | é a identidade; sem isso é grupo de Facebook | 1,5 d |
| Card e página novos (Mural · Garagem · Encontros · Membros · Sobre) sobre o desenho da Jesse | | 2 d |
| `clubId` em `events` e em `communityGoals`; criar evento e post a partir do clube; chip `[TAG]` no card de evento e no `GoalCard` | integra as duas features existentes com um campo cada | 0,5 d |
| Garagem automática (metas publicadas dos membros) | vitrine sem escrita nova | 0,5 d |
| Descoberta: região primeiro + anti-tela-vazia, chips de estilo, "pro seu carro", "em alta" = próximo encontro | | incluído acima |
| i18n pt-BR/en-US/es-ES de tudo (estilos, papéis, políticas, telas) | regra da casa | 0,5 d |
| Seed: 10 clubes oficiais + `featured/clubOfWeek` editorial | mata o "poucos clubes" no dia 1 | 0,5 d (dado, não código) |

Fora da fase 1, de propósito: aprovação de pedidos tem UI mínima (lista +
aprovar/recusar) mas convite não; sem título cosmético; sem conquistas de
clube; sem upload de emblema; sem ranking além de "membros" e "encontros".

### Fase 2 — a crew fica completa (≈ 4–5 dias)

Garagem por escolha (`garage/{uid}`) e contador de carros; `joinPolicy:
invite`; conquistas de clube (lista fechada + check no cliente); título
cosmético; ranking por estado × estilo (membros, encontros, presença);
membros novos em 30 dias no "em alta"; `membersOnly` em evento; upload de
emblema/capa quando Storage ligar; "criar o próximo encontro fixo" com um
clique; transferência de fundação.

### Fase 3 — rivalidade e conversa (sem estimativa honesta ainda)

Desafio entre clubes no mesmo evento; clube da semana automático; chat de
grupo (coleção nova, regra nova); selo "verificado" pra clube real (Civic
Club Brasil, Fusca Clube do Brasil) por processo manual do admin; km opt-in
cosmético se pedirem; `contentVisibility: members` no mural.

### O que eu recomendo cortar mesmo da fase 1 se apertar

Na ordem: `joinPolicy: approval` (deixa só `open`; clube fechado espera a
fase 2) → `meetupSchedule` → regras do clube. **Não cortar**: sigla, emblema
gerado, cores, cidade, foco, `clubId` em eventos. Sem esses seis não é crew.

---

## 9. Fontes

Camadas conforme a disciplina do projeto: **primária** = o próprio produto ou
o próprio clube falando de si; **secundária** = terceiro descrevendo;
**agregador** = listas/notícias, usadas só como pista.

### Produtos comparáveis

| fonte | camada | o que foi tirado |
|---|---|---|
| Strava — Clubs on Strava, https://support.strava.com/hc/en-us/articles/216918347-Clubs-on-Strava | primária (help oficial) | Owner é criado automaticamente e **não sai sem transferir**; admins aprovam pedidos, promovem/rebaixam, removem; clube invite-only aparece mas esconde atividade e discussão; leaderboard semanal top 10/100 com reset domingo 23:59; clube com > 50 mil sem feed; capa + foto de perfil. |
| Strava — Group Events for Clubs, https://support.strava.com/hc/en-us/articles/216918607-Group-Events-for-Clubs | primária | Só owner/admin cria evento do clube; data/hora/local obrigatórios; capacidade fecha o "Join"; evento não passa de um dia; compartilhável como flyer. |
| Strava — leaderboard/club types (busca), https://communityhub.strava.com/t5/the-club-hub/clubs-on-strava/ta-p/7986 | secundária (hub oficial da comunidade) | Até 3 tags de tipo de clube; público vs privado. |
| GTA Online — Crew Hierarchies, https://www.gtaboom.com/crew-hierarchies-and-gta-online-1bb1 | secundária (reproduz o newswire da Rockstar) | Cinco cargos: Leader (tudo), Commissioner (tudo em nome do líder, promove/rebaixa/convida), Lieutenant (promove/rebaixa abaixo dele), Representative (recrutamento), Muscle (nada). Motivou reduzir a 3 papéis. |
| GTA Online — crew tag/emblema (busca), https://www.techshout.com/how-to-make-a-crew-in-gta-5/ e https://www.sportskeeda.com/gta/gta-online-how-create-cool-emblems-crew | agregador | Tag de **quatro letras maiúsculas que segue o nome do jogador no lobby**; editor de emblemas próprio; lema (motto) na criação. Origem direta da `tag` + `motto` + emblema gerado. |
| NFS Unbound — Meetups (busca), https://nfs.fandom.com/wiki/Need_for_Speed:_Unbound/Meetups | agregador (wiki) | "Meetup" como ponto de encontro com rivais; Unbound trocou progressão de crew por encontros online. Reforça encontro > mural. |
| Forza Horizon (busca), https://forums.forza.net/t/in-game-club-system-like-forza-horizon-2-and-3/816798 e https://www.windowscentral.com/forza-horizon-4-clubs-and-multiplayer | agregador | Clubes FH4 rodam sobre Xbox Clubs, limite de 25 em times; tag de clube não aparecia no jogador (reclamação de lançamento); FH6 cortou clubes. Lição: **tag que não aparece no membro é tag que não existe**. |
| Discord — roles (busca), https://zapier.com/blog/discord-roles/ e https://support.discord.com/hc/en-us/articles/4409571023639-Custom-Role-Icons-FAQ | agregador / primária (FAQ de ícones) | Hierarquia arrastável, cor do nome vem do cargo mais alto, ícone de cargo ao lado do nome, "display separately" na lista. Virou `title` cosmético na fase 2 e "fundador e capitães primeiro" na aba Membros. |
| Discord — Verified servers, https://support.discord.com/hc/en-us/articles/360047236171-Partnered-vs-Verified-Servers | primária | Selo verde = "casa oficial" de uma organização. Virou o selo de clube real na fase 3. |
| Facebook Groups — admin tools (busca), https://groupboss.io/blog/facebook-group-admin-tools/ | agregador | Regras do grupo, perguntas de entrada, badges, admin vs moderador. Confirma o que o clube **não** deve ser (mural com capa) e de onde vem `rules[]`. |
| Revv Social, https://www.joinrevvsocial.com/ | primária (site do produto) | "Build your crew profile, showcase your members and their builds, and keep the conversation going in your private crew chat"; "find one that matches your style". Origem de garagem-do-clube e de "estilo" como eixo de descoberta. |
| Carvonix (App Store), https://apps.apple.com/us/app/carvonix/id1661267102 | primária (descrição oficial) | "Vehicle Crew" com eventos, drives guiados por GPS e meetups; garagem virtual; "CX Points" e rank de usuário. |
| GarageApp / Car Social (busca), https://garageapp.com/blog/garage-app-features/best-apps-for-car-enthusiasts/ , https://www.carsocialapp.com/ | agregador / primária | Existem 4+ apps de crew automotiva lançados 2025-2026 nos EUA; nenhum encontrado com vocabulário FIPE ou ficha por versão. |

### Clubes reais brasileiros

| fonte | camada | o que foi tirado |
|---|---|---|
| Civic Club Brasil, https://www.instagram.com/civicbrasil/ | primária (o clube sobre si) | Bio: "Desde 1972 fazendo história. Faça parte da nossa família. Parceiros: @osakagaragem \| @officialgaijin", 79,5 mil seguidores, emblema 🔰. Origem de `foundedYear` anterior ao app e do tom "família". |
| Civic Club Brasil Oficial®, https://www.instagram.com/honda_civic_club_brasil/ | primária | "Apaixonados por Civic sejam bem-vindos… Oficiais parceiras @hjapan.taubate, @hjapan.guaratingueta", 40,8 mil. Dois clubes disputam o mesmo nome — argumento pra **sigla única** e selo verificado. |
| Rebaixados Club#, https://www.instagram.com/rebaixadosclub/ | primária | Bio: "Lugar de mola é no lixo". Exemplo de lema. |
| FuscaPoços, https://www.fuscapocos.com.br/ | primária | Fundado 12/09/2004, Poços de Caldas/MG; encontro **no 1º domingo de cada mês** na Praça José Affonso Junqueira; sede social; "Diretoria do Clube". Origem de `meetupSchedule` e de cargo cosmético. |
| VW Clubes (diretório da Volkswagen do Brasil), https://www.vw.com.br/pt/volkswagen/clubes.html | primária (a marca lista clubes) | ~50 clubes **agrupados por estado**, cada um com parágrafo de história e link (site/Facebook/Instagram). "Polo Mk6 Club nasceu 15 de agosto de 2017 como um simples grupo no Facebook"; "Fusca Clube do Brasil, fundado em maio de 1985"; "Mundo dos GTIs, idealizado em 2012". |
| Eventos VW — Clubes, https://www.eventosvw.com.br/clubes/ | secundária (diretório de terceiro) | Card por clube com **logo, nome, descrição, cidade/UF, ano de fundação, telefone, contato**; filtro por estado + índice A-Z. É basicamente o card proposto na seção 2.6. "Air Cooled BH — VWs a Ar". |
| Encontro Regional de Rebaixados de Tupã (prefeitura), https://www.tupa.sp.gov.br/noticia/4909/4-encontro-regional-de-carros-rebaixados-reuniu-mais-de-1500-pessoas/ | governamental secundária | Premiação "carro mais baixo", 1º/2º/3º em "Mtm, tuning, ar, fixa, rosca e aros 13 ao 24"; 400 carros, 1.500 pessoas. Vocabulário `rebaixados (fixa, rosca, ar)`. |
| Insane Sound / Barretos, https://www.independentes.com.br/insanesound/noticia/2842/evento-de-som-automotivo-tuning-e-carros-rebaixados-acontece-neste-final-de-semana-no-parque-do-peao | agregador (imprensa do evento) | "som automotivo, tuning e carros rebaixados"; troféus 1º-3º. Vocabulário `som`, `tuning`. |
| Expobaixos, https://www.instagram.com/expobaixos/ | primária (bio não carregou) | Só o título "maior encontro de rebaixados do Brasil" veio pela busca. Não confirmado o restante da bio. |
| Clube do Carro Antigo de Londrina / Encontro Mensal MG (busca), https://www.instagram.com/p/DJ5bgZiIA9P/ , https://www.instagram.com/p/DEm5wWOuoKA/ | agregador | Padrão "encontro mensal" e vocabulário `antigos`. |

### O que procurei e não achei / não abriu

- **GTA Wiki (Fandom) — Crews** e **NFS Wiki — Heat/Crews**: HTTP 402 no fetch
  (Fandom bloqueia). Cargos vieram do GTA BOOM; limite de 1.000 membros,
  cor de crew e tipos de crew ficaram **sem fonte primária** — cor de crew eu
  sei que existe, mas não citei por não ter conseguido abrir.
- **EA Help — How Crews work in NFS Heat**: timeout de 60 s. A mecânica de
  "crew rep" (nível de crew por reputação acumulada dos membros) ficou sem
  citação e por isso não entrou no modelo.
- **Rockstar Newswire — Introducing Crew Hierarchies**: página abriu vazia
  (só título). Usei o espelho do GTA BOOM.
- **Discord Support — Roles and Permissions**: 403. Usei Zapier + FAQ de
  ícones (esta abriu).
- **Windows Central — FH4 clubs**: conteúdo truncado antes do artigo. Só o
  resumo da busca.
- **Sportskeeda — how to make a crew**: 405.
- **Drivvo**: é gestão de despesas; **nenhum recurso social ou de clube**
  encontrado. Não é comparável.
- **"Clube do Carro" (clubedocarroapp.com.br)**: é marketplace de repasse por
  assinatura (R$ 49,90/mês, "até 50% abaixo da tabela"); o nome engana. Não
  tem clube. Dead end.
- **Carbase**: é uma oficina de preparação (carbase.com.br), não app. Dead
  end.
- **Grupos do Facebook de Civic/marca no Brasil**: Facebook não abre sem
  login; o que sei de regras/admin/moderador veio de agregadores. Nenhum
  grupo específico citado.
- **Xbox Clubs (base do FH4)**: não pesquisado a fundo; a lição do tag
  invisível bastou.
- **Vocabulário `jdm`, `euro`, `muscle`, `preparados`, `offroad`**: não
  achei bio ou evento citável usando a palavra nesta rodada. Marcados
  [inferido] na tabela de estilos; confirmar com o Murilo (ele conhece a
  cena) custa menos que mais uma hora de busca.
