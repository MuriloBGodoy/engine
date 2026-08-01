# 📋 Testes Pendentes - Engine App

**Data de criação:** 2026-07-30  
**Última atualização:** 2026-07-30  
**Status:** Em progresso  
**Progresso:** Backend integrado ✅ | Testes pendentes 🔄

---

## ✅ Testes de Integração Backend-Frontend

### 1. Criar Evento
- [ ] Acessar página de eventos
- [ ] Preencher formulário (título, descrição, data, local)
- [ ] Submeter formulário
- [ ] Verificar se evento aparece na lista (DevTools Network: POST `/api/events`)
- [ ] Verificar dados salvos no Firestore
- [ ] Testar RSVP do evento criado

**Status:** ⏳ Pendente

---

### 2. Criar Meta (Goal)
- [ ] Acessar seção de metas/goals
- [ ] Preencher formulário (nome, descrição, target, etc)
- [ ] Submeter
- [ ] Verificar se meta aparece na lista (DevTools Network: POST `/api/community/goals`)
- [ ] Verificar tamanho da resposta vs otimização feita (deve ser < 400 kB)
- [ ] Testar comentários na meta

**Status:** ⏳ Pendente

---

### 3. Adicionar Carro
- [ ] Acessar garagem/cars
- [ ] Preencher dados do carro (modelo, ano, placa, etc)
- [ ] Submeter
- [ ] Verificar se carro aparece na lista (DevTools Network: POST `/api/cars`)
- [ ] Verificar se foto do carro é carregada corretamente
- [ ] Testar edição de carro existente

**Status:** ⏳ Pendente

---

### 4. Notificações
- [ ] Verificar se notificações carregam via backend
- [ ] DevTools Network: GET `/api/notifications`
- [ ] Tempo de carregamento deve ser < 500ms
- [ ] Marcar como lido deve atualizar via backend

**Status:** ⏳ Pendente

---

### 5. Estado Global (State)
- [ ] Verificar se state carrega corretamente (user, settings, etc)
- [ ] DevTools Network: GET `/api/state`
- [ ] Performance: deve ser < 1s (era 896ms em última medição)
- [ ] Logout deve limpar state

**Status:** ⏳ Pendente

---

## 🚀 Futuras Adições com Testes

### Feature: [Nome da feature]
- [ ] Teste 1
- [ ] Teste 2
- [ ] Teste 3

**Status:** ⏳ Pendente

---

## 📊 Métricas de Performance

**Meta:** Goals endpoint deve estar < 400 kB e carregar em < 2s

| Endpoint | Tamanho Inicial | Tamanho Otimizado | Tempo Inicial | Tempo Otimizado | Status |
|----------|---|---|---|---|---|
| `/api/community/goals` | 2,130 kB | 303 kB | 2.67s | 1.39s | ✅ Otimizado |
| `/api/state` | - | 0.8 kB | - | 896ms | ⏳ Testando |
| `/api/notifications` | - | 2.6 kB | - | 207ms | ⏳ Testando |
| `/api/events` | - | ? | - | ? | ⏳ Pendente |
| `/api/cars` | - | ? | - | ? | ⏳ Pendente |

---

## 🔧 Checklist Geral

- [x] Backend Java (Spring Boot) integrado
- [x] CORS configurado e funcionando
- [x] Credenciais Firebase (service-account.json)
- [x] Frontend conectado ao backend via VITE_API_URL
- [x] Otimização goals endpoint (85% redução)
- [ ] **Testes E2E de todos os fluxos**
- [ ] Testes de performance em produção
- [ ] Documentação de deployment
- [ ] CI/CD pipeline (se necessário)

---

## 📝 Notas

- Cache desativado nos testes via DevTools (Disable cache checkbox)
- Todos os testes devem rodar com backend em 8080 e frontend em 5173
- Verificar Network tab para validar requisições ao backend
- Monitorar tamanho de respostas pós-otimizações

