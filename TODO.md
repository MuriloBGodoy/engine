# TODO — o que falta

Lista acionável do que ficou pendente. O **porquê** de cada decisão está no
`ROADMAP.md`; aqui é só o que fazer.

Última atualização: 14 de agosto de 2026.

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

## Bugs resolvidos em 07/08/2026

Todos verificados no app. Ficou de pé só o que a causa raiz exige: **as fotos
moram dentro do documento do Firestore**, então cada uma pesa no limite de
1 MiB, na velocidade da gravação e no custo da leitura. O Blaze resolve os
quatro de uma vez, sem código novo.

| Bug | Commit |
| --- | --- |
| Salvar carro apagava a foto | `5bfc370` |
| Miniaturas de moto no "Compartilhar meta" | `5bfc370` |
| Legenda virava a bio do perfil | `5bfc370` |
| Publicação levava uma foto só | `5bfc370` |
| Perda silenciosa ao estourar 1 MiB | `4f8a11d` |
| Garagem "sumindo" e foto não chegando ao servidor | `278e043` |

<details>
<summary>Diagnóstico original, para referência</summary>

### 1. CRÍTICO — salvar carro em dev apaga a foto

Reproduzido: clicar em "Consegui, é meu!" no Corsa apagou a imagem e não
gravou o tipo. Confirmado no Firestore: `image` vazio, `images: 0`,
`type` ausente.

**Causa raiz** (duas somadas):

- `normalizeCarImages` (`db.js:227`) só lê `car.images` e **ignora
  `car.image`**. Como deriva a capa de `images[0] || ""`, um carro que só
  tem capa vira carro sem foto nenhuma.
- Em dev, `getCars()` chama o backend Java, que devolve `image` mas
  **não** `images` — e no `saveCar` descarta os campos que não conhece
  (`type`, `images`, `ownership`, `contributions`).

Ou seja: **qualquer save de carro em dev apaga a foto**, não só o botão
novo. Em produção não acontece, porque lá o caminho é o Firestore direto.

**Correção:** fazer `normalizeCarImages` cair em `car.image` quando
`images` estiver vazio (para a sangria imediata) e tirar o branch de API
de `getCars`/`saveCar`, como já foi feito em `setFollow`,
`updateCommunityGoalNote` e `subscribeCommunityGoals`.

**Dado perdido:** a foto do Corsa precisa ser enviada de novo.

### 2. Miniaturas erradas no "Compartilhar meta"

Todos os carros aparecem com a mesma foto de moto no modal de
compartilhar. Provavelmente um fallback sendo usado porque a imagem real
não chega — possivelmente o mesmo problema do item 1.

### 3. Legenda da publicação não é usada

Ao compartilhar a meta, a descrição escrita na hora é ignorada e o que
aparece é a **bio do perfil**. O comentário em `buildCommunityGoal` diz
justamente o contrário ("Legenda escrita na hora de publicar — não é mais
a bio do perfil"), então a intenção existe e a ligação quebrou em algum
ponto entre o modal e o `note`.

### 4. Publicação não leva as fotos do veículo

Compartilhar uma meta da garagem deveria puxar **todas** as fotos
cadastradas naquele carro, e hoje não leva. Ajustar também o
enquadramento para caber direito na tela.

</details>

## Código

### Fechar o portão de cobrança

Está tudo pronto; falta só a decisão de negócio.

- [ ] Dar plano cortesia aos 20–30 primeiros prestadores (escrever
      `plan: "premium"` no doc deles via Admin SDK)
- [ ] Virar `SUBSCRIPTION_GATE_OPEN` para `false` em `Services.jsx`

**Não fechar antes de conseguir mostrar retorno ao prestador.** O painel de
métricas do anúncio já existe justamente para isso — sem número para mostrar, o
cancelamento vem no segundo mês.

### Simulador — puxar dado real das fontes mapeadas

Inventário completo, com endpoints verificados, em **`SIMULADOR-FONTES.md`**.
Na ordem de retorno:

- [ ] **ANP semanal → Firestore.** Os valores foram remedidos à mão em
      14/08/2026 (preços, `FUEL_FACTOR_BR` e o novo `FUEL_FACTOR_BR_ETHANOL`),
      então o ganho agora é não apodrecer. CSV público, sem autenticação, ~8 MB
      por semana. Falta também o **diesel**, que está noutro arquivo da ANP e
      segue com valor de jul/2026 não reconferido
- [ ] **BCB SGS 25471 mensal → Firestore.** Cinco linhas. Hoje o ganho é nulo
      (1,97% contra 1,99%), mas a série já marcou 1,63% e vai divergir de novo
- [x] ~~**IPVA do Amazonas está 2× errado**~~ — corrigido em 13/08/2026: AM foi
      para 2,0% (1,5% elétrico), CE para 3,0%, e o PR já estava certo com 1,9%
- [x] ~~**`MT: 0.0345` sem confirmação**~~ — corrigido em 14/08/2026 para 3,0%
      (Portaria SEFAZ-MT 196/2025, art. 2º VII). O 3,45% era a alíquota de
      utilitários de GOIÁS; provável contaminação entre UFs vizinhas
- [x] ~~**IPVA cobrado em carro de qualquer idade**~~ — corrigido em 14/08/2026.
      A EC 137/2025 tornou imune o veículo com 20+ anos de fabricação em todo o
      país; `IPVA_BR_EXEMPT_AGE` cobre GO (15), RJ (16) e MT (18) por cima disso
- [ ] **MS, PI e BA — únicos suspeitos de erro PARA BAIXO.** Numa calculadora
      comercial que usa média entre faixas, os três aparecem acima da nossa
      faixa máxima, o que só é possível se a faixa real for maior. É a única
      direção de erro que o motor não pode ter. Três leis, ~40 min cada
- [ ] **Híbrido em SP é isento até 31/12/2026** (Lei 18.065/2024), depois 1% em
      2027, 2% em 2028, 3% em 2029, 4% de 2030. Cobramos 4% hoje: R$ 600/mês
      num híbrido de R$ 180 mil. Depende de `FUEL_TYPES` distinguir híbrido de
      combustão, que hoje não distingue
- [ ] **Medir o viés FIPE × base do IPVA.** A base não é a FIPE: em SP é tabela
      própria da SEFAZ congelada em setembro do ano anterior. A Resolução
      SFP-40/25 publica a tabela de 2026 — **conferir se o anexo é planilha ou
      PDF** (meia hora). Se for planilha, dá para medir o viés de verdade em vez
      de supor que erramos para cima
- [ ] **Isenção por idade nas ~15 UFs que faltam.** O piso nacional de 20 anos
      já está aplicado e erra para cima, então isto é ganho marginal: são as UFs
      que isentam antes (o "grupo dos 15" em fonte secundária, mais AP e RR com
      10 anos e fontes que se contradizem). Um dia de trabalho, lei por lei
- [ ] **Alíquota de elétrico por UF.** Existe `IPVA_BR_ELECTRIC`, mas só com o
      AM — e continua só com o AM depois da rodada de 14/08: o MT não tem inciso
      de elétrico na portaria vigente, e o DF isenta mas de forma **condicional**
      (só se comprado de revendedor do DF), o que não cabe num escalar
- [x] ~~**Job mensal de amostragem FIPE histórica**~~ — recalibrada em
      13/08/2026 por corte transversal (90 pares, 21 modelos). Curva era o
      padrão americano (16/12/10/8/6/4), virou 10/7/5,5/5/5,5. Falta a série
      longitudinal para separar depreciação de efeito de safra
- [ ] **Manutenção não distingue veículo nenhum.** É `valor × 4% × fator de km`,
      então um Lancer 2.0 e um Onix 1.0 do mesmo preço custam igual para manter.
      Sem fonte verificada de custo de peça e mão de obra por marca — não
      inventar fator; procurar dado antes
- [x] ~~**Completo mais barato que terceiros abaixo de R$ 11 mil**~~ — fechado em
      14/08/2026: o prêmio de terceiros virou piso do completo
- [ ] **Casco não existe em carro velho, e o motor finge que existe.** Acima de
      15–20 anos a seguradora tradicional não vende completo; o motor dá 20% de
      desconto (`carAgeFactor`) e cospe um prêmio para uma apólice que não está
      à venda. O certo é não responder, não responder errado
- [ ] **Piso absoluto do seguro.** RCF, assistência, emissão e IOF não escalam
      com o FIPE, então % puro está errado no limite. Ordem de grandeza R$ 1.200
      a R$ 1.800/ano — **sem fonte**, por isso não entrou. Decisão sua: assumir
      um default grosseiro rotulado ou seguir sem
- [ ] **AUTOSEG** para extrair os fatores relativos de faixa etária e região.
      **Reverificar de outra rede:** notícia da SUSEP de jun/2024 diz que a base
      foi reaberta em caráter permanente, o que contradiz o "congelado em 2020"
      do inventário. `www2.susep.gov.br` inalcançável daqui, e o `dados.gov.br`
      passou a exigir chave de API (401)
- [ ] **Franquia via Open Insurance** — API pública sem autenticação, chaveada
      por CEP + FIPE + ano. Não traz prêmio, mas traz franquia, que hoje o
      simulador ignora

- [ ] **A base de consumo não é do INMETRO.** Desrotulada na tela em 14/08/2026
      (eram 24 tuplas distintas para 91 modelos, com diesel em Gol e Kwid).
      Continua em uso como estimativa por categoria, que ainda separa um Hilux
      de um Mobi. Trocar por medição real é caso para o `expenses.js`, igual à
      manutenção — e decide ~2/3 da conta da tela

Não fazer: pipeline de PDF do INMETRO, pipeline por país para seguro
internacional, e procurar API de cotação de seguro — está bloqueada por registro
de corretora na SUSEP, é decisão de parceria e não de engenharia. Também não
adianta API comercial de IPVA (Infosimples, Celcoin, APIBrasil): todas consultam
débito por placa + RENAVAM, e aqui o carro ainda não foi comprado.

### Notificação de lembrete

Agora destravada: o registro de gastos existe, então há conteúdo para lembrar
("faz 40 dias do último abastecimento lançado"). Com parcimônia — notificação
sem conteúdo bom vira desinstalação. Web push funciona no Android e, no iOS,
para quem adicionou o app à tela de início.

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

## Já feito nesta sessão (06/08/2026)

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

## Já feito em 11/08/2026

| Entrega | Commit |
| --- | --- |
| Gasto real do carro que a pessoa já tem (item 9) | `02b5e9e` |
| Simulador comparando com o gasto real | `68049ab` |

O item 9 fechou os três encaixes que justificavam ele: o simulador agora bebe
de dado medido em vez de estimativa, a meta ganha contexto ("você gasta X com o
que tem; o que quer sairia por Y") e lançar lavagem, revisão ou pneu oferece um
prestador na hora — que é onde frequência de uso encontra receita.

Fica de pé uma tensão conhecida: cada lançamento lê a garagem inteira e
reescreve o documento do carro, que hoje carrega as fotos em base64. Funciona,
mas é mais um lugar em que o Blaze deixaria de ser opcional.
