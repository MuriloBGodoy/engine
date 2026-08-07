# Paridade backend Java × frontend

Levantado em 06/08/2026 chamando cada endpoint com um ID token real e
comparando os campos devolvidos com os normalizadores do `engine/src/services/db.js`.

Isto é a lista de tarefas para quando a API virar o caminho único (troca de
banco). Enquanto o front tiver `if (apiEnabled())` função a função, cada
divergência aqui vira bug que só aparece em dev.

## Situação

Produção roda `VITE_API_URL` vazio → tudo Firebase direto. O backend Java só
roda em dev. Ou seja: os buracos abaixo não afetam usuário nenhum hoje, mas
bloqueiam a migração.

## Rotas

Todas as 23 chamadas do `db.js` têm rota correspondente, com duas exceções que
já foram removidas do front (passaram a ler o Firestore direto):

| Chamada | Situação |
| --- | --- |
| `PATCH /community/goals/{id}` | não existe no controller — só `/like` e `/rating` |
| `GET /community/goals/{id}` | não existe |

Rota existir não significa payload certo — veja abaixo.

## Payload

| Endpoint | Falta devolver | Impacto |
| --- | --- | --- |
| `GET /cars` | `images`, `ownership`, `contributions` | galeria de fotos some (fica só a capa), o simulador de custo de posse (TCO) desaparece e o histórico de aportes não volta |
| `GET /community/goals` | `image`, `images`, `verified`, `note`, `userId` | post sem foto, sem legenda e sem selo; monta `noteKey` em vez de `note` |
| `GET /settings` | — | ok (devolve `security` a mais, ignorado) |
| `GET /community/state` | — | ok |
| `GET /community/users` | — | ok, é mapa `userId → perfil` |
| `GET /notifications` | — | ok |

`saveCar` grava com `SetOptions.merge()`, então o que o backend não conhece
(`images`, `ownership`) **não é apagado** do Firestore — o buraco é de leitura,
não de perda de dado.

## Semântica

| Endpoint | Problema |
| --- | --- |
| `POST /community/users/{id}/follow` | o nome no service é `notifyFollow` e é só isso que faz: cria notificação. Não grava `followers` nem `following`. Não existe `DELETE` para deixar de seguir. |

## Ordem sugerida para a migração

1. Levar cada endpoint acima a paridade de payload, com teste que compare a
   resposta da API com a leitura equivalente no Firestore.
2. Implementar o que falta de semântica (persistir follow/unfollow de verdade,
   `PATCH` de legenda, `GET` de post único).
3. Só então arrancar os `if (apiEnabled())` do `db.js` e deixar uma camada só.

Enquanto 1 e 2 não estiverem prontos, manter `VITE_API_URL` vazio também em
dev: hoje ele faz o desenvolvimento rodar num caminho que produção não usa.
