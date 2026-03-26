# Concierge

Plataforma SaaS focada em turismo no Piaui, com recomendacoes turisticas
assistidas por IA e frontend preparado para operacao em ambiente self-hosted.

## Visao geral

Este repositorio centraliza o frontend do projeto Concierge e agora ja deixa
o backend separado para evolucao gradual da arquitetura.

Prioridades atuais:

- evolucao continua com fluxo de branches
- qualidade automatizada via CI
- deploy continuo em VPS com Coolify + Traefik

## Estrutura do repositorio

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
│   │   └── package.json
│   └── backend/
│       ├── Dockerfile
│       ├── src/
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── supabase/
│   └── functions/
│       └── chat/
└── README.md
```

## Stack

- React 19 + TypeScript + Vite
- Node 22 + TypeScript para backend dedicado
- CSS Modules
- Docker multi-stage + Nginx (SPA)
- GitHub Actions (CI)
- Coolify self-hosted + Traefik (CD e HTTPS)

## Convencao de branches

- `main`: producao
- `dev`: homologacao (staging)
- `feature/*`: desenvolvimento de funcionalidades

## Ambiente local

### Pre-requisitos

- Node.js 22
- npm 10+

### Execucao

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

### Scripts principais

- `npm run dev`: desenvolvimento
- `npm run build`: build de producao
- `npm run preview`: preview local do build
- `npm run lint`: validacao estatica

## Variaveis de ambiente

Arquivo base: `apps/frontend/.env.example`

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` para apontar ao backend Node quando a migracao sair da Edge Function

Backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `N8N_CHAT_WEBHOOK_URL`
- `N8N_CHAT_CHANNEL`
- `N8N_CHAT_SOURCE`
- `ALLOWED_ORIGIN`
- `PORT`

Observacao: o backend Node e a Edge Function do Supabase podem coexistir durante a migracao.

## CI/CD

### CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

Disparos:

- `push` em `main` e `dev`
- `pull_request` para `main` e `dev`
- somente quando ha mudancas em `apps/frontend/**` ou no proprio workflow

Etapas:

1. `npm ci`
2. `npm run lint`
3. `npm run build`

Objetivo: bloquear integracoes com erro antes do deploy.

No estado atual, a pipeline automatizada continua focada no frontend. O backend
foi separado em `apps/backend` para permitir migracao gradual sem quebrar a
operacao existente.

### CD (Coolify + Traefik)

Fluxo de entrega:

`git push` -> GitHub Actions (CI) -> Coolify (build/deploy) -> Traefik (HTTPS)

Configuracao recomendada do app no Coolify:

- Source: `Kiwada/Concierge`
- Build Pack: `Dockerfile`
- Base Directory: `/apps/frontend`
- Dockerfile path: `/Dockerfile`
- Exposed Port: `80`
- Auto Deploy: habilitado

## Infraestrutura (VPS self-hosted)

Arquitetura operacional:

1. VPS Linux hospeda Docker e Coolify
2. Coolify orquestra build e ciclo de vida dos containers
3. Traefik atua como reverse proxy e gerencia certificados HTTPS
4. Frontend roda em container Nginx (SPA) publicado via dominio
5. Backend Node pode ser publicado separadamente para concentrar autenticacao,
   contexto do usuario e proxy seguro para o n8n

Topologia simplificada:

```text
GitHub Repo (main/dev)
        |
        v
GitHub Actions (CI: lint + build)
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
- `main` -> dominio de producao

Atencao: o branch configurado no Coolify precisa ser o mesmo branch do push.

## Notas operacionais

- Linux em producao e case-sensitive para nomes de arquivos.
- Em assets de `public/`, prefira caminhos absolutos (`/assets/...`).
- Use historico de deployments no Coolify para rollback rapido.

## Documentacao complementar

- `apps/frontend/README.md`
