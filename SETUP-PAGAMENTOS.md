# Setup de pagamentos — checklist para quando for cobrar

**Estado: o código está pronto e no ar** (commit `a28021b`). Falta só criar as
contas e colar as chaves. Nada aqui exige mexer em código.

Enquanto as chaves não existirem, o app funciona normalmente — só não é
possível assinar. O portão de cobrança está **aberto**, ou seja, publicar
serviço segue livre para todo mundo.

---

## O que o Premium libera

Um plano só, com dois benefícios:

1. Navegar **sem anúncio nenhum**
2. **Divulgar serviços** na aba Serviços

Preço definido no código: **R$ 25 / US$ 6 / € 6** por mês
(`netlify/functions/lib/providers.js`, constante `PLAN_PRICES`).

---

## Como está montado

Nenhuma chave secreta vai para o navegador. Quem fala com o gateway são as
Netlify Functions.

| Peça | Onde | Faz o quê |
| --- | --- | --- |
| `subscription-create` | Netlify Function | cria o checkout e devolve o link |
| `subscription-webhook-mercadopago` | Netlify Function | ativa/corta o plano (LatAm) |
| `subscription-webhook-stripe` | Netlify Function | ativa/corta o plano (EUA e Europa) |
| `users/{uid}.plan` | Firestore | fonte da verdade; só o webhook escreve |
| `useIsPremium` | frontend | lê o plano e libera as funcionalidades |

**Provedor por região** (`lib/providers.js`): Mercado Pago para BR, AR, MX, CL
e CO; Stripe para US, PT, ES, GB, FR, DE e IT.

---

## Checklist

### 1. Firebase — credencial do servidor

- [ ] Console do Firebase › Configurações do projeto › **Contas de serviço**
- [ ] **Gerar nova chave privada** → baixa um JSON
- [ ] Guardar o conteúdo **inteiro, em uma linha** para colar em
      `FIREBASE_SERVICE_ACCOUNT`
- [ ] Nunca commitar esse arquivo (o `.gitignore` já cobre o
      `service-account.json` do backend Java, mas confira)

### 2. Mercado Pago (LatAm)

Aceita **pessoa física, só com CPF** — não precisa de CNPJ.

- [ ] Criar conta e abrir a **Conta Negócio**
- [ ] Painel de desenvolvedores › **Suas integrações** › criar aplicação
- [ ] Copiar o **Access Token de produção** (não o de teste) →
      `MERCADOPAGO_ACCESS_TOKEN`
- [ ] Em **Webhooks / Notificações**, cadastrar a URL:
      `https://SEU-SITE/.netlify/functions/subscription-webhook-mercadopago`
- [ ] Marcar o evento **Assinaturas** (`subscription_preapproval`)
- [ ] Copiar a **chave secreta** da notificação → `MERCADOPAGO_WEBHOOK_SECRET`

### 3. Stripe (EUA e Europa)

Também aceita **CPF** — não exige CNPJ. Desde 27/04/2026 há verificação KYC
obrigatória: CPF, prova de vida por selfie e confirmação de renda. A conta
bancária vinculada precisa ser em BRL, num banco brasileiro, no mesmo CPF.

- [ ] Criar conta e completar o KYC
- [ ] Criar um **produto recorrente mensal** ("Engine Premium")
- [ ] Criar os preços: **US$ 6** e **€ 6**
- [ ] Copiar o id do preço (começa com `price_`) → `STRIPE_PRICE_ID`
- [ ] Copiar a chave secreta → `STRIPE_SECRET_KEY`
- [ ] Developers › Webhooks › adicionar endpoint:
      `https://SEU-SITE/.netlify/functions/subscription-webhook-stripe`
- [ ] Selecionar os eventos:
      - `checkout.session.completed`
      - `customer.subscription.updated`
      - `customer.subscription.deleted`
- [ ] Copiar o **signing secret** → `STRIPE_WEBHOOK_SECRET`

> Se quiser começar só pelo Mercado Pago, pode: sem as chaves do Stripe, as
> regiões dele apenas não conseguem assinar, sem quebrar nada. Os primeiros
> clientes são brasileiros de qualquer forma.

### 4. Netlify — colar as variáveis

Site settings › **Environment variables**. Nenhuma leva prefixo `VITE_`, de
propósito: tudo que começa com `VITE_` vai para o bundle do navegador, e estas
são secretas.

- [ ] `FIREBASE_SERVICE_ACCOUNT`
- [ ] `MERCADOPAGO_ACCESS_TOKEN`
- [ ] `MERCADOPAGO_WEBHOOK_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PRICE_ID`
- [ ] `STRIPE_WEBHOOK_SECRET`

Aproveitar e colar também as de observabilidade, que ficaram pendentes:

- [ ] `VITE_SENTRY_DSN`
- [ ] `VITE_POSTHOG_KEY`

### 5. Testar antes de abrir

- [ ] Mercado Pago: usar as **credenciais de teste** e um comprador de teste
- [ ] Stripe: modo de teste + `stripe listen` para conferir o webhook local
- [ ] Assinar de ponta a ponta e confirmar que `users/{uid}.plan` virou
      `premium` no Firestore
- [ ] Conferir que o anúncio sumiu para o assinante
- [ ] Cancelar e conferir que volta para `free`

### 6. Só então ligar a cobrança

- [ ] Em `engine/src/pages/Services.jsx`, virar `SUBSCRIPTION_GATE_OPEN` para
      `false`
- [ ] Antes disso, ter dado **plano cortesia** para os 20–30 primeiros
      prestadores (escrever `plan: "premium"` no doc deles pelo Admin SDK)

**Disciplina combinada:** não fechar o portão antes de conseguir mostrar
retorno ao prestador. O painel de métricas do anúncio (já pronto) é o que
sustenta a renovação — sem número para mostrar, o cancelamento vem no segundo
mês.

---

## Situação fiscal

Nada disso exige CNPJ para começar. Mas, recebendo como pessoa física:

- o dinheiro entra como **renda tributável no IR**, pela tabela progressiva
  (até 27,5%);
- **não dá para emitir nota fiscal**, e prestador com empresa pode pedir.

Abrir MEI é online e gratuito, mas **confirmar se a atividade está na lista de
ocupações permitidas** — nem toda atividade digital entra. Vale meia hora com
um contador antes de escolher o CNAE.

Recomendação: começar com CPF, validar se as pessoas assinam, e abrir MEI
quando o faturamento justificar.
