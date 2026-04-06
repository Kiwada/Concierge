# ConciergeHub

**Language:** [PT-BR](#pt-br) | [English](#english)

---

## PT-BR

Plataforma de concierge digital para turismo no litoral do Piauí, com frontend React autenticado via Supabase, backend Fastify para orquestração segura e n8n como motor de automação e IA.

### Sumário

- [Visão geral](#visão-geral)
- [Arquitetura atual](#arquitetura-atual)
- [Fluxo do chat](#fluxo-do-chat)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Stack](#stack)
- [Ambiente local](#ambiente-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Contrato entre backend e n8n](#contrato-entre-backend-e-n8n)
- [Persistência do histórico](#persistência-do-histórico)
- [Deploy e operação](#deploy-e-operação)
- [Documentação complementar](#documentação-complementar)

### Visão geral

O projeto foi organizado para separar claramente as responsabilidades:

- `apps/frontend`: aplicação web do cliente
- `apps/backend`: API autenticada para chat, SSE, histórico e integração com n8n
- `supabase/`: assets relacionados ao Supabase
- `docs/`: documentação de arquitetura e diagramas operacionais

O fluxo atual prioriza:

- autenticação e contexto do usuário no frontend e backend
- n8n como camada de automação e IA, sem expor segredos ao cliente
- persistência do histórico oficial no Supabase
- experiência de chat resiliente com cache local + reidratação remota

### Arquitetura atual

```text
Frontend React
  |
  |  POST /api/chat/messages
  |  GET  /api/chat/events/:sessionId   (SSE)
  |  GET  /api/chat/history/:sessionId
  v
Backend Fastify
  |
  |  valida auth no Supabase
  |  carrega user_profiles
  |  persiste chat_sessions/chat_messages
  |  chama webhook do n8n
  v
n8n
  |
  |  processa mensagem
  |  usa Prompt Builder / Agent / Tools
  |  faz callback assíncrono
  v
Backend Fastify
  |
  |  POST /api/chat/callback
  |  publica SSE para o cliente
  |  persiste reply da assistente
  v
Frontend React
```

#### Responsabilidades por camada

##### Frontend

- autenticação do usuário via Supabase
- UI do chat
- cache local de sessão e transcript
- assinatura do stream SSE
- recuperação do histórico persistido

##### Backend

- validação de bearer token
- montagem de `userInfo` a partir de `auth.users` + `user_profiles`
- criação e isolamento de sessão por usuário
- orquestração do fluxo assíncrono com n8n
- persistência oficial do histórico no Supabase

##### n8n

- automação do atendimento
- montagem de prompt
- execução do modelo
- uso futuro de tools, como Google Places
- callback para o backend com `processing`, `reply` e `error`

### Fluxo do chat

#### Fluxo em produção

1. o frontend autenticado envia `message` e `sessionId` para `POST /api/chat/messages`
2. o backend valida o token e monta `userInfo`
3. o backend registra a sessão no event bus e persiste a mensagem do usuário
4. o backend dispara o webhook do n8n
5. o backend devolve `202 Accepted` imediatamente
6. o frontend abre SSE em `GET /api/chat/events/:sessionId`
7. o n8n processa e chama `POST /api/chat/callback`
8. o backend publica eventos `buffering`, `processing`, `reply` ou `error`
9. o frontend atualiza a UI em tempo real

#### Endpoints do backend

- `GET /healthz`
- `POST /api/chat`
  - rota legada síncrona
- `POST /api/chat/messages`
  - rota principal do fluxo assíncrono
- `GET /api/chat/events/:sessionId`
  - SSE do atendimento
- `GET /api/chat/history/:sessionId`
  - histórico persistido da conversa
- `POST /api/chat/callback`
  - callback autenticado do n8n

### Estrutura do repositório

```text
concicerge/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── lib/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── public/
│       ├── src/
│       │   ├── components/
│       │   ├── contexts/
│       │   ├── lib/
│       │   └── services/
│       ├── Dockerfile
│       ├── nginx/
│       └── package.json
├── docs/
│   └── n8n-final-workflow-with-tools.svg
├── packages/
├── scripts/
├── supabase/
├── package.json
└── README.md
```

### Stack

#### Frontend

- React 19
- TypeScript
- Vite
- CSS Modules
- Supabase JS

#### Backend

- Node.js
- Fastify
- TypeScript
- Supabase JS

#### Infra e automação

- Supabase self-hosted
- n8n self-hosted
- Docker
- Coolify
- Traefik

### Ambiente local

#### Pré-requisitos

- Node.js 22+
- npm 10+
- instância Supabase acessível
- backend e frontend configurados com `.env`

#### Instalação na raiz

```bash
npm install
```

#### Subir frontend

```bash
npm run dev:frontend
```

Frontend local:

```text
http://localhost:5173
```

#### Subir backend

```bash
npm run dev:backend
```

Backend local:

```text
http://localhost:3000
```

#### Builds

```bash
npm run build:frontend
npm run build:backend
```

#### Comandos por app

##### Frontend

```bash
cd apps/frontend
npm run dev
npm run build
npm run preview
npm run lint
```

##### Backend

```bash
cd apps/backend
npm run dev
npm run build
npm run start
```

### Variáveis de ambiente

#### Frontend

Arquivo base: `apps/frontend/.env.example`

Obrigatórias para login e fluxo principal:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

Observações:

- quando `VITE_API_URL` está presente, o frontend usa o fluxo assíncrono com backend + SSE
- sem `VITE_API_URL`, o frontend pode cair no fluxo legado

#### Backend

Arquivo base: `apps/backend/.env.example`

Obrigatórias para o fluxo atual:

- `PORT`
- `ALLOWED_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `N8N_CHAT_WEBHOOK_URL`
- `N8N_CHAT_CALLBACK_SECRET`
- `N8N_CHAT_CHANNEL`
- `N8N_CHAT_SOURCE`

Obrigatória para persistência oficial do histórico:

- `SUPABASE_SERVICE_ROLE_KEY`

Opcional:

- `CHAT_BUFFER_WINDOW_MS`

### Contrato entre backend e n8n

#### Payload enviado ao n8n

O backend envia ao webhook do n8n um payload limpo com:

```json
{
  "message": "texto atual do cliente",
  "sessionId": "uuid",
  "channel": "web",
  "source": "concierge-web",
  "userInfo": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Nome do usuário",
    "preferredLanguage": "pt-BR",
    "originCity": "cidade",
    "interests": ["praia", "gastronomia"],
    "travelStyle": ["casal"],
    "budgetProfile": "luxo",
    "companionsSummary": "casal",
    "notes": null,
    "updatedAt": "2026-04-03T11:50:03.066265+00:00"
  }
}
```

#### Callback esperado do n8n

O backend espera:

```json
{
  "sessionId": "uuid",
  "status": "processing | reply | error",
  "reply": "texto final da assistente",
  "messageId": "uuid-opcional-mas-recomendado"
}
```

#### Workflow atual no n8n

Fluxo principal recomendado:

1. `Webhook`
2. `Payload`
3. `Callback Processing`
4. `Prompt Builder`
5. `Basic LLM Chain` ou `AI Agent`
6. `Reply Payload`
7. `CallBackReply`
8. `Respond to Webhook`

Se houver tools:

- preferir `AI Agent`
- usar `Call n8n Workflow Tool` para integrações externas

Diagrama de referência:

- `docs/n8n-final-workflow-with-tools.svg`

### Persistência do histórico

#### Fonte oficial

O histórico oficial da conversa fica no Supabase:

- `chat_sessions`
- `chat_messages`

#### O que é persistido

- mensagem do usuário em `POST /api/chat/messages`
- resposta da assistente em `POST /api/chat/callback`

#### O que não é persistido oficialmente

Mensagens de onboarding local e saudações efêmeras do frontend permanecem fora do histórico oficial por decisão de produto. O contexto definitivo do usuário deve ficar em:

- `auth.users`
- `user_profiles`
- `chat_sessions`
- `chat_messages`

#### Estratégia atual da UI

A UI usa duas camadas:

1. cache local por `sessionId`
2. reidratação remota por `GET /api/chat/history/:sessionId`

Isso melhora:

- refresh de página
- retomada de conversa
- resiliência contra latência momentânea do histórico remoto

### Deploy e operação

#### Produção

Topologia atual recomendada:

```text
GitHub
  |
  v
Coolify
  |
  +-- Frontend
  +-- Backend
  +-- n8n
  +-- Supabase
```

#### Serviços principais

- frontend web
- backend Fastify
- n8n principal
- n8n worker / webhook, quando aplicável
- Supabase

#### Health checks

Backend:

```text
GET /healthz
```

#### Observações operacionais

- o backend precisa do mesmo `ALLOWED_ORIGIN` do frontend publicado
- `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas no backend
- `N8N_CHAT_CALLBACK_SECRET` deve ser conhecido só por backend e n8n
- se houver troca de usuário na mesma máquina, o frontend agora isola a sessão por identidade
- o backend faz recuperação defensiva para `chat-session-owner-mismatch`, gerando nova sessão quando necessário

### Documentação complementar

- `docs/n8n-final-workflow-with-tools.svg`
- `docs/README.md`
- `packages/README.md`
- `scripts/README.md`

### Notas finais

Este `README` descreve o estado atual do sistema orientado ao fluxo:

- frontend autenticado
- backend como camada de confiança
- n8n como automação e IA
- Supabase como identidade, perfil e histórico persistido

Se o fluxo de IA ou de tools mudar, atualize primeiro:

1. contrato do backend
2. payload do n8n
3. variáveis de ambiente
4. esta documentação

[Back to top](#conciergehub)

---

## English

Digital concierge platform focused on travel experiences in the Piauí coastline, with a React frontend authenticated through Supabase, a Fastify backend for secure orchestration, and n8n as the automation and AI runtime.

### Table of contents

- [Overview](#overview)
- [Current architecture](#current-architecture)
- [Chat flow](#chat-flow)
- [Repository structure](#repository-structure)
- [Stack](#stack-1)
- [Local environment](#local-environment)
- [Environment variables](#environment-variables)
- [Backend and n8n contract](#backend-and-n8n-contract)
- [Chat history persistence](#chat-history-persistence)
- [Deployment and operations](#deployment-and-operations)
- [Additional documentation](#additional-documentation)

### Overview

The repository is organized around clear responsibility boundaries:

- `apps/frontend`: customer-facing web application
- `apps/backend`: authenticated API for chat, SSE, history, and n8n integration
- `supabase/`: Supabase-related assets
- `docs/`: architecture notes and operational diagrams

The current platform priorities are:

- authentication and user context handled in frontend and backend
- n8n as the automation and AI layer, without exposing secrets to the client
- official chat history persisted in Supabase
- resilient chat UX with local cache plus remote rehydration

### Current architecture

```text
React Frontend
  |
  |  POST /api/chat/messages
  |  GET  /api/chat/events/:sessionId   (SSE)
  |  GET  /api/chat/history/:sessionId
  v
Fastify Backend
  |
  |  validates auth with Supabase
  |  loads user_profiles
  |  persists chat_sessions/chat_messages
  |  calls n8n webhook
  v
n8n
  |
  |  processes the message
  |  uses Prompt Builder / Agent / Tools
  |  sends async callback
  v
Fastify Backend
  |
  |  POST /api/chat/callback
  |  publishes SSE to the client
  |  persists assistant reply
  v
React Frontend
```

#### Responsibilities by layer

##### Frontend

- user authentication through Supabase
- chat UI
- local session and transcript cache
- SSE subscription
- persisted history recovery

##### Backend

- bearer token validation
- `userInfo` composition from `auth.users` + `user_profiles`
- per-user session creation and isolation
- async orchestration with n8n
- official history persistence in Supabase

##### n8n

- chat automation
- prompt composition
- model execution
- future tool usage, such as Google Places
- callback to the backend with `processing`, `reply`, and `error`

### Chat flow

#### Production flow

1. the authenticated frontend sends `message` and `sessionId` to `POST /api/chat/messages`
2. the backend validates the token and builds `userInfo`
3. the backend registers the session in the event bus and persists the user message
4. the backend dispatches the n8n webhook
5. the backend immediately returns `202 Accepted`
6. the frontend opens SSE on `GET /api/chat/events/:sessionId`
7. n8n processes the request and calls `POST /api/chat/callback`
8. the backend publishes `buffering`, `processing`, `reply`, or `error`
9. the frontend updates the UI in real time

#### Backend endpoints

- `GET /healthz`
- `POST /api/chat`
  - legacy synchronous route
- `POST /api/chat/messages`
  - main asynchronous route
- `GET /api/chat/events/:sessionId`
  - SSE for chat delivery
- `GET /api/chat/history/:sessionId`
  - persisted chat history
- `POST /api/chat/callback`
  - authenticated n8n callback

### Repository structure

```text
concicerge/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── lib/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── public/
│       ├── src/
│       │   ├── components/
│       │   ├── contexts/
│       │   ├── lib/
│       │   └── services/
│       ├── Dockerfile
│       ├── nginx/
│       └── package.json
├── docs/
│   └── n8n-final-workflow-with-tools.svg
├── packages/
├── scripts/
├── supabase/
├── package.json
└── README.md
```

### Stack

#### Frontend

- React 19
- TypeScript
- Vite
- CSS Modules
- Supabase JS

#### Backend

- Node.js
- Fastify
- TypeScript
- Supabase JS

#### Infrastructure and automation

- self-hosted Supabase
- self-hosted n8n
- Docker
- Coolify
- Traefik

### Local environment

#### Requirements

- Node.js 22+
- npm 10+
- accessible Supabase instance
- backend and frontend configured with `.env`

#### Install at the repository root

```bash
npm install
```

#### Start frontend

```bash
npm run dev:frontend
```

Local frontend:

```text
http://localhost:5173
```

#### Start backend

```bash
npm run dev:backend
```

Local backend:

```text
http://localhost:3000
```

#### Builds

```bash
npm run build:frontend
npm run build:backend
```

#### Per-app commands

##### Frontend

```bash
cd apps/frontend
npm run dev
npm run build
npm run preview
npm run lint
```

##### Backend

```bash
cd apps/backend
npm run dev
npm run build
npm run start
```

### Environment variables

#### Frontend

Base file: `apps/frontend/.env.example`

Required for login and the main chat flow:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

Notes:

- when `VITE_API_URL` is present, the frontend uses the asynchronous backend + SSE flow
- without `VITE_API_URL`, the frontend may fall back to the legacy path

#### Backend

Base file: `apps/backend/.env.example`

Required for the current flow:

- `PORT`
- `ALLOWED_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `N8N_CHAT_WEBHOOK_URL`
- `N8N_CHAT_CALLBACK_SECRET`
- `N8N_CHAT_CHANNEL`
- `N8N_CHAT_SOURCE`

Required for official history persistence:

- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `CHAT_BUFFER_WINDOW_MS`

### Backend and n8n contract

#### Payload sent to n8n

The backend sends a normalized payload to the n8n webhook:

```json
{
  "message": "latest user message",
  "sessionId": "uuid",
  "channel": "web",
  "source": "concierge-web",
  "userInfo": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "preferredLanguage": "pt-BR",
    "originCity": "city",
    "interests": ["praia", "gastronomia"],
    "travelStyle": ["casal"],
    "budgetProfile": "luxo",
    "companionsSummary": "casal",
    "notes": null,
    "updatedAt": "2026-04-03T11:50:03.066265+00:00"
  }
}
```

#### Callback expected from n8n

The backend expects:

```json
{
  "sessionId": "uuid",
  "status": "processing | reply | error",
  "reply": "final assistant text",
  "messageId": "uuid-optional-but-recommended"
}
```

#### Current n8n workflow

Recommended main flow:

1. `Webhook`
2. `Payload`
3. `Callback Processing`
4. `Prompt Builder`
5. `Basic LLM Chain` or `AI Agent`
6. `Reply Payload`
7. `CallBackReply`
8. `Respond to Webhook`

If tools are introduced:

- prefer `AI Agent`
- use `Call n8n Workflow Tool` for external integrations

Reference diagram:

- `docs/n8n-final-workflow-with-tools.svg`

### Chat history persistence

#### Official source of truth

Official conversation history lives in Supabase:

- `chat_sessions`
- `chat_messages`

#### What is persisted

- user messages in `POST /api/chat/messages`
- assistant replies in `POST /api/chat/callback`

#### What is not officially persisted

Local onboarding prompts and ephemeral frontend greetings stay outside the official history by product decision. The definitive user context should live in:

- `auth.users`
- `user_profiles`
- `chat_sessions`
- `chat_messages`

#### Current UI strategy

The UI uses two layers:

1. local cache keyed by `sessionId`
2. remote rehydration via `GET /api/chat/history/:sessionId`

This improves:

- page refresh recovery
- conversation resumption
- resilience against temporary latency in remote history

### Deployment and operations

#### Production

Recommended production topology:

```text
GitHub
  |
  v
Coolify
  |
  +-- Frontend
  +-- Backend
  +-- n8n
  +-- Supabase
```

#### Core services

- frontend web app
- Fastify backend
- main n8n instance
- n8n worker / webhook, when applicable
- Supabase

#### Health checks

Backend:

```text
GET /healthz
```

#### Operational notes

- the backend must allow the same `ALLOWED_ORIGIN` used by the published frontend
- `SUPABASE_SERVICE_ROLE_KEY` must stay backend-only
- `N8N_CHAT_CALLBACK_SECRET` must be shared only between backend and n8n
- when users switch accounts on the same machine, the frontend now isolates chat sessions by identity
- the backend performs defensive recovery for `chat-session-owner-mismatch` by issuing a new session when needed

### Additional documentation

- `docs/n8n-final-workflow-with-tools.svg`
- `docs/README.md`
- `packages/README.md`
- `scripts/README.md`

### Final notes

This `README` documents the current system as it actually operates:

- authenticated frontend
- backend as the trust boundary
- n8n as the automation and AI layer
- Supabase as identity, profile, and persisted chat history

If the AI flow or tool layer changes, update these in order:

1. backend contract
2. n8n payload shape
3. environment variables
4. this documentation

[Back to top](#conciergehub)
