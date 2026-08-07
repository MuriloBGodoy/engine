# TODO — o que falta

Lista acionável do que ficou pendente. O **porquê** de cada decisão está no
`ROADMAP.md`; aqui é só o que fazer.

Última atualização: 5 de agosto de 2026.

---

## Depende de você (não é código)

### Chaves de observabilidade — 10 minutos

O código está pronto e desligado até as chaves existirem.

- [ ] Criar conta no **Sentry** e pegar o DSN
- [ ] Criar conta no **PostHog** e pegar a chave (começa com `phc_`)
- [ ] Colar `VITE_SENTRY_DSN` e `VITE_POSTHOG_KEY` no `engine/.env`
- [ ] Colar as mesmas duas nas variáveis de ambiente do **Netlify** — sem isso
      só funciona no seu localhost

Sem isso você não fica sabendo quando alguém toma um erro, e continua decidindo
produto no escuro.

### Gateways de pagamento — algumas semanas à frente

Checklist completo e passo a passo em **`SETUP-PAGAMENTOS.md`**. Resumo:

- [ ] Service account do Firebase
- [ ] Conta Mercado Pago (aceita CPF) + access token + webhook
- [ ] Conta Stripe (também aceita CPF) + produto/preços + webhook
- [ ] Seis variáveis de ambiente no Netlify
- [ ] Testar de ponta a ponta em modo teste

### Domínio próprio — ~R$ 40/ano

- [ ] Comprar no registro.br
- [ ] Apontar no Netlify
- [ ] Depois de apontar, revisar três lugares que hoje usam o domínio do
      Netlify: `start_url` no manifest do PWA, URLs de retorno do checkout em
      `subscription-create.js`, e os endereços de webhook cadastrados nos dois
      gateways

### Firebase Blaze — quando decidir

Enquanto o Storage estiver desligado, `photos.js` cai no fallback e grava a
imagem em **base64 dentro do documento do Firestore** (teto de 1 MiB por
documento; o feed lê 20 documentos por página com a imagem embutida). Funciona
com poucos usuários; quebra com gente de verdade subindo foto.

### Legal — antes de divulgar

- [ ] Revisão por advogado (as páginas descrevem o sistema com precisão, mas
      isso não é revisão jurídica)
- [ ] Traduzir termos e privacidade — hoje só em português, e o produto suporta
      12 países. Para a Europa o GDPR exige mais que tradução: base legal,
      consentimento de cookie e canal de exercício de direitos
- [ ] Trocar o responsável para o CNPJ quando abrir MEI
- [ ] Consentimento de cookies para quando o AdSense entrar

### MEI — quando o faturamento justificar

Nem Mercado Pago nem Stripe exigem CNPJ; os dois aceitam CPF. Mas recebendo
como pessoa física o dinheiro é renda tributável pelo IR (até 27,5%) e não dá
para emitir nota, que prestador com empresa pode pedir. Confirmar com contador
se a atividade está na lista de ocupações permitidas do MEI.

---

## Código

### Fechar o portão de cobrança

Está tudo pronto; falta só a decisão de negócio.

- [ ] Dar plano cortesia aos 20–30 primeiros prestadores (escrever
      `plan: "premium"` no doc deles via Admin SDK)
- [ ] Virar `SUBSCRIPTION_GATE_OPEN` para `false` em `Services.jsx`

**Não fechar antes de conseguir mostrar retorno ao prestador.** O painel de
métricas do anúncio já existe justamente para isso — sem número para mostrar, o
cancelamento vem no segundo mês.

### Custo do carro que a pessoa já tem (item 9)

Segunda parte do problema de frequência, e projeto próprio.

Hoje o `OwnershipModal` **simula** quanto custaria o carro que você quer — é
projeção para decidir a compra, usada uma vez. Falta registrar o que a pessoa
**realmente gasta** com o carro que já tem: abastecimento, manutenção, seguro,
impostos.

Por que vale: carro-meta é sonho de anos, carro atual gera gasto toda semana. E
quem quer trocar de carro é quem já tem um.

Três encaixes:
- alimenta o simulador com dado real em vez de estimativa;
- dá contexto à meta ("você gasta R$ 1.400 com o Jetta; o Golf custaria
  R$ 1.700");
- **liga frequência com receita** — registrar "troquei o óleo" é o momento
  exato de mostrar um prestador da região.

Escopo: modelar despesa (categoria, valor, data, odômetro), resumo por mês e
por categoria, consumo real em km/l, e integração com o simulador existente.

### Notificação de lembrete

Só depois do registro de gastos, e com parcimônia — notificação sem conteúdo
bom vira desinstalação. Web push funciona no Android e, no iOS, para quem
adicionou o app à tela de início.

### Dívida técnica conhecida

- [ ] `Services.jsx` tem 5 erros de lint anteriores a esta sessão: dois
      `setState` dentro de efeito e três funções de moderação declaradas e nunca
      usadas (`approveListing`, `openReturnListing`, `openRejectListing`) —
      cheiram a funcionalidade que ficou pela metade
- [ ] Backend Java só roda em dev e não tem paridade de payload; inventário
      completo em `engine-api/PARIDADE.md`
- [ ] Itens das listas Seguidores/Seguindo no perfil já abrem o perfil da
      pessoa, mas o mesmo não vale para outras listas de usuário do app

---

## Já feito nesta sessão (05/08/2026)

| Entrega | Commit |
| --- | --- |
| Brecha de edição em `communityGoals` fechada e testada | `6651f29` |
| Denúncia e bloqueio | `6651f29` |
| Sentry + PostHog (desligados até ter chave) | `b13eec2` |
| PWA instalável | `6afe1d3` |
| Portfólio do prestador (Instagram, TikTok, vídeo) | `b0aeb6f` |
| Métricas do anúncio + leitura pública sem login | `eb8d663` |
| Assinatura Premium (Mercado Pago + Stripe) | `a28021b` |
| Aporte como evento + previsão da meta | `f88745c` |
| Termos de uso e política de privacidade | `e792d55` |
