# Concierge

**Language:** [PT-BR](#pt-br) | [English](#english)

---

## PT-BR

### Visao geral

Plataforma SaaS focada em turismo no Piaui, com recomendacoes turisticas
assistidas por IA e frontend preparado para operacao em ambiente self-hosted.

Este repositorio mantem a separacao entre frontend, backend, Supabase e
camadas de organizacao como `docs/`, `scripts/` e `packages/`.

Prioridades atuais:

- evolucao continua com fluxo de branches
- qualidade automatizada via CI
- deploy continuo em VPS com Coolify + Traefik

### Estrutura do repositorio

```text
concierge/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── nginx/
│   │   ├── public/
│   │   ├── src/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── package-lock.json
│   └── backend/
│       ├── Dockerfile
│       ├── src/
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── README.md
│   └── architecture.md
├── packages/
│   └── README.md
├── scripts/
│   ├── README.md
│   └── frontend-build.sh
├── supabase/
│   ├── functions/
│   │   └── chat/
│   └── sql/
├── package.json
├── package-lock.json
└── README.md
```

### Stack

- React 19 + TypeScript + Vite
- Node 22 + TypeScript para backend dedicado
- CSS Modules
- Docker multi-stage + Nginx
- GitHub Actions
- Coolify self-hosted + Traefik
- Supabase para auth e banco

### Convencao de branches

- `main`: producao
- `dev`: homologacao
- `feature/*`: desenvolvimento de funcionalidades

### Ambiente local

#### Pre-requisitos

- Node.js 22
- npm 10+

#### Execucao

Frontend:

```bash
cd apps/frontend
npm install
npm run dev
```

Aplicacao local: `http://localhost:5173`

Backend:

```bash
cd apps/backend
npm install
npm run dev
```

API local: `http://localhost:3000`

#### Scripts principais

- `npm run dev`: desenvolvimento
- `npm run build`: build de producao
- `npm run preview`: preview local do build
- `npm run lint`: validacao estatica
- `scripts/frontend-build.sh`: atalho para build do frontend a partir da raiz

### Variaveis de ambiente

Arquivo base do frontend: `apps/frontend/.env.example`

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

Backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `N8N_CHAT_WEBHOOK_URL`
- `N8N_CHAT_CHANNEL`
- `N8N_CHAT_SOURCE`
- `ALLOWED_ORIGIN`
- `PORT`

Observacao: o backend Node e as edge functions do Supabase podem coexistir
durante a migracao.

### CI/CD

#### CI

Workflow: `.github/workflows/ci.yml`

Disparos:

- `push` em `main` e `dev`
- `pull_request` para `main` e `dev`
- apenas quando ha mudancas relevantes no frontend ou no workflow

Etapas:

1. `npm ci`
2. `npm run lint`
3. `npm run build`

#### CD

Fluxo:

`git push` -> GitHub Actions -> Coolify -> Traefik

Configuracao recomendada no Coolify para o frontend:

- Source: `Kiwada/Concierge`
- Build Pack: `Dockerfile`
- Base Directory: `/apps/frontend`
- Dockerfile path: `/Dockerfile`
- Exposed Port: `80`
- Auto Deploy: habilitado

### Infraestrutura

1. VPS Linux hospeda Docker e Coolify
2. Coolify orquestra build e ciclo de vida dos containers
3. Traefik atua como reverse proxy e gerencia HTTPS
4. Frontend roda em Nginx
5. Backend Node pode ser publicado separadamente para autenticacao, contexto e integracao segura com n8n

Topologia simplificada:

```text
GitHub Repo (main/dev)
        |
        v
GitHub Actions (CI)
        |
        v
Coolify (CD) on VPS
        |
        v
Traefik (80/443 + TLS)
        |
        v
Frontend Nginx Container
        |
        v
Optional Backend Node API
```

Ambientes sugeridos:

- `dev` -> `staging.conciergehub.com.br`
- `main` -> producao

### Notas operacionais

- Linux em producao e case-sensitive para nomes de arquivos
- em `public/`, prefira caminhos absolutos como `/assets/...`
- use historico de deployments no Coolify para rollback rapido

### Documentacao complementar

- `apps/frontend/README.md`
- `docs/README.md`
- `docs/architecture.md`

[Back to top](#concierge)

---

## English

### Overview

A tourism-focused SaaS platform for Piaui, with AI-assisted travel
recommendations and a frontend prepared for self-hosted operation.

This repository keeps frontend, backend, Supabase, and organizational layers
such as `docs/`, `scripts/`, and `packages/` clearly separated.

Current priorities:

- continuous evolution with a branch workflow
- automated quality gates through CI
- continuous deployment on a VPS with Coolify + Traefik

### Repository structure

```text
concierge/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── nginx/
│   │   ├── public/
│   │   ├── src/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── package-lock.json
│   └── backend/
│       ├── Dockerfile
│       ├── src/
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── README.md
│   └── architecture.md
├── packages/
│   └── README.md
├── scripts/
│   ├── README.md
│   └── frontend-build.sh
├── supabase/
│   ├── functions/
│   │   └── chat/
│   └── sql/
├── package.json
├── package-lock.json
└── README.md
```

### Stack

- React 19 + TypeScript + Vite
- Node 22 + TypeScript for a dedicated backend
- CSS Modules
- Docker multi-stage + Nginx
- GitHub Actions
- Self-hosted Coolify + Traefik
- Supabase for auth and database

### Branch convention

- `main`: production
- `dev`: staging
- `feature/*`: feature development

### Local environment

#### Requirements

- Node.js 22
- npm 10+

#### Running locally

Frontend:

```bash
cd apps/frontend
npm install
npm run dev
```

Local app: `http://localhost:5173`

Backend:

```bash
cd apps/backend
npm install
npm run dev
```

Local API: `http://localhost:3000`

#### Main scripts

- `npm run dev`: development
- `npm run build`: production build
- `npm run preview`: local build preview
- `npm run lint`: static validation
- `scripts/frontend-build.sh`: frontend build shortcut from the repo root

### Environment variables

Frontend base file: `apps/frontend/.env.example`

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

Backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `N8N_CHAT_WEBHOOK_URL`
- `N8N_CHAT_CHANNEL`
- `N8N_CHAT_SOURCE`
- `ALLOWED_ORIGIN`
- `PORT`

Note: the Node backend and Supabase edge functions can coexist during the migration.

### CI/CD

#### CI

Workflow: `.github/workflows/ci.yml`

Triggers:

- `push` on `main` and `dev`
- `pull_request` to `main` and `dev`
- only when relevant frontend or workflow files change

Steps:

1. `npm ci`
2. `npm run lint`
3. `npm run build`

#### CD

Flow:

`git push` -> GitHub Actions -> Coolify -> Traefik

Recommended Coolify configuration for the frontend:

- Source: `Kiwada/Concierge`
- Build Pack: `Dockerfile`
- Base Directory: `/apps/frontend`
- Dockerfile path: `/Dockerfile`
- Exposed Port: `80`
- Auto Deploy: enabled

### Infrastructure

1. A Linux VPS hosts Docker and Coolify
2. Coolify orchestrates builds and container lifecycle
3. Traefik acts as reverse proxy and manages HTTPS
4. The frontend runs on Nginx
5. The Node backend can be published separately for auth, user context, and secure n8n integration

Simplified topology:

```text
GitHub Repo (main/dev)
        |
        v
GitHub Actions (CI)
        |
        v
Coolify (CD) on VPS
        |
        v
Traefik (80/443 + TLS)
        |
        v
Frontend Nginx Container
        |
        v
Optional Backend Node API
```

Suggested environments:

- `dev` -> `staging.conciergehub.com.br`
- `main` -> production

### Operational notes

- production runs on Linux and is case-sensitive for file names
- in `public/`, prefer absolute paths such as `/assets/...`
- use Coolify deployment history for quick rollback

### Additional documentation

- `apps/frontend/README.md`
- `docs/README.md`
- `docs/architecture.md`

[Back to top](#concierge)
