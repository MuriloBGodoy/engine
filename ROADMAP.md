# Engine — decisões e roadmap

Consolidado da sessão de 06/08/2026. Este arquivo é a fonte de verdade das
decisões de produto e técnicas: o **porquê** de cada escolha, não só o que fazer.

---

## 1. O que o Engine é

Rede social de **aspiração automotiva**: a pessoa cadastra o carro que quer,
acompanha a economia, publica na comunidade, segue outras pessoas, entra em
clubes. Mais uma vertical de **Serviços** (marketplace de prestadores).

**O Engine não é um marketplace de compra e venda.** A comparação certa para
decisões de estratégia é o **Strava** (rede social de atividade, com clubes,
seguir e ranking), não a Webmotors — que é transação. A Webmotors serve como
referência de interface, não de modelo de negócio.

---

## 2. Modelo de negócio (decidido em 06/08/2026)

**Quem paga é o prestador de serviço, não o dono do carro.**

- A aba Serviços é **aberta ao público**, inclusive sem login: qualquer um vê.
- Para **divulgar** um serviço, o prestador assina (~R$ 20–25/mês).
- Nicho de entrada: **microempreendedor de estética automotiva** — detailing,
  lavagem, polimento, vitrificação, higienização. Gente que já se divulga em
  TikTok e Instagram e não tem onde organizar portfólio.
- Aquisição: **outbound manual**. Ir na conta da pessoa no TikTok/Instagram e
  oferecer a plataforma, um a um. Para os primeiros 50 não existe caminho
  melhor — foi assim que Airbnb, Stripe e DoorDash recrutaram o lado da oferta.

### Por que esse modelo e não cobrar do usuário final

| | cobrar do prestador | cobrar do dono do carro |
|---|---|---|
| Ticket | R$ 25/mês, B2B | R$ 20/mês, B2C |
| Para faturar R$ 1.000/mês | 40 assinantes | 50 assinantes → exige ~2.500 ativos → ~25.000 cadastros |
| Efeito colateral | **o prestador traz a audiência dele** | nenhum |

O último ponto é o que decide: o prestador com 4 mil seguidores que coloca
"portfólio no Engine" na bio **resolve o problema do ovo e da galinha**. Cada
assinante vira canal de aquisição, em vez de consumir audiência que teria que
existir antes.

### A frase que precisa se sustentar

> "Por que eu pagaria se o Instagram é de graça?"

Resposta: **o Instagram mostra você para quem já te segue; o Engine mostra você
para quem está procurando o serviço agora, na sua cidade.** Se a plataforma não
sustentar essa frase, a venda não fecha.

### O risco número 1: o mês 2

O prestador paga empolgado no primeiro mês. No segundo pergunta "quantos
clientes vieram daí?". Sem resposta, cancela.

Por isso **métrica de retorno não é funcionalidade bonita, é o produto**:
visualizações do anúncio, aberturas do perfil, cliques no WhatsApp. É o que
renova a assinatura.

**Disciplina:** não ligar o portão de cobrança antes de conseguir mostrar
retorno. A primeira leva de cancelamentos é mais cara que atrasar a cobrança.

### Regras de execução

- Os primeiros 20–30 prestadores entram de graça (vitalício ou 1 ano) em troca
  de divulgarem. Resolve a aba vazia.
- **Pagamento com Pix**, não só cartão. MEI brasileiro pagando R$ 25/mês
  converte muito melhor com Pix/boleto recorrente (Asaas, Mercado Pago) do que
  com cartão via Stripe.
- **Vídeo por link, não hospedado.** Campo para link do Instagram/TikTok com
  embed. Hospedar vídeo no Firebase queima banda e dinheiro.

---

## 3. O problema central do produto: frequência

Comprar carro é meta de anos. A pessoa cadastra a meta e... volta quando? Um
produto que se abre uma vez por mês não constrói comunidade. Esse problema é
mais sério que qualquer decisão de stack.

As peças que já existem e resolvem isso:

- **Custo real de posse (TCO)** — puxa o carro que a pessoa **já tem**. Gasto
  com combustível, manutenção, IPVA é mensal, não anual.
- **Feed da comunidade** — a pessoa volta pelo conteúdo dos outros, como no
  Strava.
- **Aporte na meta** — quem guarda dinheiro guarda todo mês.

Sobre monetização B2C (secundária): pagar por rede social é raro. Se um dia
cobrar do usuário final, cobrar pela **ferramenta de decisão** (TCO completo,
comparação, alerta de FIPE) — não pelo social. Hard paywall converte ~5x mais
que freemium (10–12% contra 2,1%), mas mataria o crescimento da rede; então
social grátis, ferramenta paga.

---

## 4. Antes de abrir o link ao público

### Feito em 06/08/2026

- [x] **Brecha de segurança em `communityGoals`**: a regra era
      `allow update: if signedIn()`, sem checar dono nem campos — qualquer
      usuário logado reescrevia título, foto, valores ou legenda de qualquer
      publicação pelo SDK. Corrigido e testado contra produção com token real.
- [x] **Denúncia e bloqueio**: coleção `reports` (só a moderação lê), bloqueio
      escondendo publicações e comentários, e lista de bloqueados com
      desbloquear em Configurações › Privacidade.

### Pendente

- [ ] **Sentry** — sem isso, erro de JavaScript na mão do usuário só se descobre
      se a pessoa contar.
- [ ] **PostHog** — quantos abrem, o que usam, onde abandonam, quantos voltam.
      Responde com dado quase todas as perguntas de estratégia abaixo.
- [ ] **Domínio próprio** (~R$ 40/ano). Maior sinal de legitimidade por real
      gasto; `.netlify.app` custa confiança.
- [ ] **Política de privacidade e termos** publicados.
- [ ] **Firebase Blaze** — adiado por decisão do usuário ("mais para frente").
      Enquanto o Storage estiver desligado, `photos.js` cai no fallback e grava
      a imagem em **base64 dentro do documento do Firestore** (teto de 1 MiB por
      documento; o feed lê 20 documentos por página com a imagem embutida).
      Funciona com poucos usuários, quebra com gente de verdade.

---

## 5. Estratégia mobile

**Ordem decidida: PWA → Play Store (TWA) → App Store (React Native), cada etapa
só quando a anterior justificar.**

### Por quê

- O PWA **não precisa ser instalado**. A pessoa clica no link e usa. No app
  nativo a instalação é a porta de entrada (confiança cobrada adiantado); no
  PWA é o fim do funil (confiança construída pelo uso).
- Taxa de instalação de PWA no iOS é de um dígito baixo — não existe prompt,
  só "Adicionar à Tela de Início" manual. **Não fazer o funil depender de
  instalação.**
- O TWA da Play Store **é o próprio PWA empacotado** (US$ 25 uma vez). O
  trabalho do PWA não é jogado fora — vira o app da Play.
- React Native **não reaproveita a interface**: são 17.696 linhas de UI em 63
  arquivos `.jsx` que seriam reescritas (não tem `div` nem Tailwind). As ~6.800
  linhas de lógica em services e hooks migram quase direto. O Expo EAS Build
  compila iOS na nuvem, sem precisar de Mac.
- **Evitar Capacitor para uso pesado**: foi WebView que fez o Facebook queimar
  dois anos ("o maior erro que cometemos como empresa foi apostar em HTML5 em
  vez de nativo", Zuckerberg, 2012). O React Native nasceu como resposta a esse
  erro. Para o uso leve do Engine o risco é menor, mas se o produto virar uso
  diário e intenso, o caminho é RN, não WebView.

### Quando fazer o app

O gatilho não é "parecer sério". É função que só o celular dá, ou usuário
pedindo. No Strava o app destravou a atividade principal (gravar treino em
movimento) e veio 2 anos depois do site. No Letterboxd nada exigia celular e o
app demorou 6 anos — e a plataforma cresceu mesmo assim.

Cadastrar meta e acompanhar economia **não exige** celular. O Engine ainda não
tem a função que obriga um app.

---

## 6. Monetização e comissões das lojas

- **PWA instalado pelo navegador: zero comissão.** Stripe direto, você paga só
  a taxa do gateway. É por isso que Spotify e Netflix empurram assinatura para
  o site.
- **PWA na Play Store (TWA)**: a política exige Play Billing (Digital Goods API
  + Payment Request API). Nova estrutura de assinaturas: 10% de taxa + 5% se
  usar Play Billing. **Anunciado para EUA, Reino Unido e EEE — confirmar a
  regra do Brasil no Play Console.**
- **App Store**: nos EUA links externos liberados sem comissão desde a decisão
  Epic v. Apple (abr/2025); na UE exige entitlement e taxas. **Nenhuma das duas
  cobre o Brasil** — assumir IAP até prova em contrário.
- **Desenho recomendado**: vender assinatura só na web; o app (se existir)
  apenas reconhece quem já é assinante, modelo Netflix.
- **Anúncios em app**: dentro de app empacotado a política do Google pede
  **AdMob**, não AdSense. O `AdSlot.jsx` já é provider-agnostic, então a troca é
  contida.

---

## 7. Anúncios: não ligar o AdSense agora

RPM no Brasil: R$ 8–15 genérico, R$ 25–80 premium (finanças, seguros). Mas
aqueles RPMs altos são de **sites de conteúdo** com tráfego de busca e intenção
comercial. O Engine é app: pageview de baixa intenção. Além disso a SPA quase
não gera pageview sem disparo manual.

| Usuários ativos | Pageviews/mês | AdSense |
|---|---|---|
| 500 | ~10.000 | R$ 100–300 |
| 5.000 | ~100.000 | R$ 1.000–3.000 |

Só vira relevante acima de ~50–100 mil pageviews/mês. Antes disso rende troco e
custa credibilidade — justamente o que falta no começo.

**O que fazer:** usar o `AdSlot` para house ads (promover o PRO, recursos,
convite de instalação) e, com base real numa região, **vender espaço direto**
para anunciante local. Com 1.000 usuários engajados de uma cidade, um
patrocinador paga R$ 300–1.000/mês — o mesmo que exigiria 30–100 mil pageviews
no AdSense. O valor do inventário do Engine é **qualificação**, não volume:
gente que declarou que vai comprar carro.

---

## 8. Backend Java

Produção roda `VITE_API_URL` vazio → tudo Firebase direto. O Java só roda em
dev, e por isso não é validado por ninguém. Isso já causou quatro bugs fantasma
em um dia. Ver `engine-api/PARIDADE.md` para o inventário completo.

- **Não bloqueia lançamento.** O FitFolio chegou a 25 mil downloads com Firebase
  puro, sem backend próprio.
- **Mas é a peça que viabiliza app nativo depois**: o que permite Webmotors ter
  app Android, app iPhone e site é a API única. Os clientes não compartilham
  tela, compartilham endpoints.
- **Ordem para a migração de banco**: (1) paridade de payload endpoint a
  endpoint, com teste; (2) implementar o que falta de semântica; (3) só então
  arrancar os `if (apiEnabled())`.
- Enquanto 1 e 2 não estiverem prontos, manter `VITE_API_URL` vazio também em
  dev.

---

## 9. Números de referência (benchmarks 2025/2026)

- Conversão freemium free→pago: **2,1%** (mediana). Hard paywall: 10–12%.
- Retenção D30 média cross-industry: **5–7%**. Apps sociais bons: 15–20%.
- FitFolio (referência de app indie que deu certo): ~25 mil downloads na Play em
  10 meses, 3.800 nos últimos 30 dias, assinatura US$ 2,59–99,99. Receita
  estimada (modelo, não dado real): **R$ 600–3.000/mês**.
- Meta concreta e realista para o primeiro ano do Engine: **50 assinantes
  pagando R$ 20–25 = ~R$ 1.000–1.250/mês**. Cinquenta pessoas é pouca gente.

---

## 10. Onde paramos (06/08/2026)

### Entregue

| Item | Commit | Observação |
| --- | --- | --- |
| Brecha de edição em `communityGoals` | `6651f29` | testada contra produção com token real |
| Denúncia e bloqueio | `6651f29` | com lista de bloqueados em Configurações |
| Sentry + PostHog | `b13eec2` | **falta colar as chaves** |
| PWA instalável | `6afe1d3` | manifest, service worker, convite e aviso de atualização |
| Portfólio do prestador | `b0aeb6f` | Instagram, TikTok e vídeo por link |
| Métricas do anúncio | `eb8d663` | aberturas e contatos, só pro dono |
| Leitura pública sem login | `eb8d663` | **era bloqueador**: link na bio caía em tela vazia |
| Assinatura Premium | `a28021b` | **falta criar as contas** — ver `SETUP-PAGAMENTOS.md` |

### Falta

1. **Frequência de uso** — aporte como evento (em andamento), depois custo do
   carro que a pessoa já tem, e só então lembrete por notificação.
2. **Configurar os gateways** — checklist completo em `SETUP-PAGAMENTOS.md`.
   Combinado para algumas semanas à frente, mais perto de divulgar.
3. **Fechar o portão** (`SUBSCRIPTION_GATE_OPEN`) — só depois de dar cortesia
   aos primeiros prestadores e de conseguir mostrar retorno a eles.
4. **Domínio próprio** — comprar no registro.br (~R$ 40/ano) e apontar no
   Netlify. Depois disso, revisar: `start_url` do manifest, as URLs de retorno
   do checkout (`subscription-create`) e os endereços cadastrados de webhook nos
   dois gateways, que hoje apontam para o domínio do Netlify.

5. **Legal — o que falta além das páginas** (as páginas em si já estão no ar):
   - **Revisão por advogado.** O texto foi escrito a partir do que o sistema
     realmente faz, mas não substitui revisão jurídica.
   - **Tradução.** Os documentos estão só em português enquanto o produto
     suporta 12 países. Para operar na Europa, o GDPR exige aviso em linguagem
     acessível ao titular — e provavelmente base legal, consentimento de cookie
     e canal de exercício de direitos, que hoje não existem.
   - **Preencher o responsável.** Hoje consta pessoa física; muda quando abrir
     MEI ou empresa, e o CNPJ passa a ser obrigatório nos documentos.
   - **Consentimento de cookies** para quando o AdSense entrar.
5. **Firebase Blaze** — adiado por decisão; enquanto isso a foto vai em base64
   dentro do documento do Firestore.

### Dívida conhecida, não urgente

- `Services.jsx` tem 5 erros de lint anteriores a esta sessão: dois `setState`
  dentro de efeito e três funções de moderação declaradas e nunca usadas
  (`approveListing`, `openReturnListing`, `openRejectListing`) — cheiram a
  funcionalidade que ficou pela metade.
- Backend Java só roda em dev e não tem paridade de payload; ver
  `engine-api/PARIDADE.md`.

## 11. Ordem de execução

1. **Observabilidade** — Sentry + PostHog. Independe de tudo, e sem isso as
   próximas decisões continuam no escuro.
2. **PWA** — manifest, service worker, ícones, prompt de instalação no momento
   certo (depois de um marco, não na primeira tela; no iOS, com instrução).
3. **Serviços como produto pago** — campos de Instagram/TikTok, link de vídeo,
   **painel de métricas do prestador**, status e validade de assinatura no
   anúncio, e por último o portão (`SUBSCRIPTION_GATE_OPEN`).
4. **Pagamento** — Asaas ou Mercado Pago com Pix recorrente.
5. **Frequência** — reforçar TCO e aporte mensal como motivo de retorno.
6. **Domínio, privacidade e termos** — antes de divulgar.
7. **Blaze** — quando o usuário decidir; é pré-requisito de foto/vídeo em
   escala e de qualquer app.
