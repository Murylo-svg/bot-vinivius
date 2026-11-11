# Chat Agente IA - Gemini + MongoDB (Arquitetura MVC)

Este repositório contém a refatoração e as melhorias aplicadas na Sprint 0 do projeto de integração com a API do Google Gemini, utilizando arquitetura modularizada (MVC).

## 🚀 Tecnologias Utilizadas
- Node.js & Express
- Mongoose & MongoDB Atlas (Persistência de Histórico de Conversas)
- Google Generative AI SDK
- Marked.js (Renderização de Markdown)

## 📁 Estrutura do Projeto
- `models/`: Definição de schemas do MongoDB.
- `controllers/`: Lógica centralizada do chat e controle de requisições.
- `routes/`: Endpoints de comunicação do Express.
- `public/`: Interface web contendo index.html.

## ⚙️ Como executar localmente
1. Instale as dependências: `npm install`
2. Crie um arquivo `.env` baseado no modelo de `.env.example` e preencha com as credenciais.
3. Inicie o servidor: `npm start` (ou `node server.js`)
4. Rode os testes: `npm test` (não precisam de MongoDB nem de chave do Gemini)
## 📊 Sprint — Dashboard Administrativo, RBAC e Analytics de IA

### Variáveis de ambiente (`.env`)
Veja `.env.example`. Obrigatórias: `MONGO_URI`, `GEMINI_API_KEY`, `JWT_SECRET`.
Opcionais: `JWT_EXPIRES_IN` (padrão `1d`) e `ANALYTICS_TIMEZONE` (padrão `America/Sao_Paulo`).

### Novas rotas
| Método | Rota | Proteção |
|---|---|---|
| POST | `/api/auth/registrar` | pública (sempre cria `role: "user"`; 5 por IP a cada 15 min) |
| POST | `/api/auth/login` | pública (10 tentativas por IP a cada 15 min) |
| POST | `/api/auth/logout` | pública |
| GET | `/api/auth/me` | JWT |
| GET | `/api/analytics/tokens` | JWT + `apenasAdmin` |
| GET | `/dashboard` | cookie de sessão + role `admin` (verificado no servidor) |
| DELETE | `/api/chat/limpar` | JWT + `apenasAdmin` (apaga todo o histórico) |

### Tornar um usuário administrador (MongoDB Atlas)
1. Cadastre-se em `/login.html` → aba **Criar conta**.
2. No Atlas: **Browse Collections** → banco do projeto → coleção `usuarios`.
3. Filtre **apenas o seu documento**: `{ "email": "seu-email@exemplo.com" }`.
4. Edite o campo `role` de `"user"` para `"admin"` e clique em **Update**.

Ou, no `mongosh`:
```js
db.usuarios.updateOne({ email: "seu-email@exemplo.com" }, { $set: { role: "admin" } })
```
Confira que o resultado mostra `matchedCount: 1`. A role é lida do banco a cada requisição,
então a mudança vale imediatamente (e a revogação também).

### Tempo real
O dashboard se conecta ao Socket.IO do próprio servidor com o JWT. Apenas administradores
entram na sala `admins`, que recebe o evento `novoGastoDeToken` após cada resposta do Gemini.

### Correções incluídas nesta sprint
- **Function calling do XP**: as `tools` estavam no 2º argumento de `getGenerativeModel` (opções da requisição)
  e nunca chegavam ao Gemini. Agora o XP funciona, e o servidor só aceita `+50` ou `-10` para o
  nickname da própria requisição (a IA não pode ser induzida a dar XP arbitrário).
- **Análise de documentos**: o `pdf-parse` 2.x não exporta mais uma função (`pdf(buffer)` lançava
  `pdf is not a function`). Migrado para `PDFParse`, com suporte a `.txt`, limite de 10 MB e modelo
  atualizado. O consumo de tokens dos documentos também aparece no dashboard (`origem: "documento"`).
- **XSS**: a resposta da IA é sanitizada com DOMPurify, e o texto do usuário e os apelidos do ranking
  são escapados.
- **Credenciais**: o arquivo `salvar` (com usuário/senha do MongoDB) foi removido. Ele continua no
  histórico do Git, então **troque a senha do usuário do banco no Atlas**.

### Hospedagem
Se o app roda atrás de proxy (Render, Railway, Heroku...), defina `TRUST_PROXY=1` para o limitador de
login enxergar o IP real de cada cliente.
