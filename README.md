# Concierge

Plataforma SaaS focada em turismo no Piaui, com recomendacoes turisticas
assistidas por IA e frontend preparado para operacao em ambiente self-hosted.

## Visao geral

Este repositorio centraliza o frontend do projeto Concierge e prioriza:

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
│   └── frontend/
│       ├── Dockerfile
│       ├── nginx/
│       ├── public/
│       ├── src/
│       ├── .env.example
│       └── package.json
└── README.md
```

## Stack

- React 19 + TypeScript + Vite
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

```bash
cd apps/frontend
npm install
npm run dev
```

Aplicacao local: `http://localhost:5173`

### Scripts principais

- `npm run dev`: desenvolvimento
- `npm run build`: build de producao
- `npm run preview`: preview local do build
- `npm run lint`: validacao estatica

## Variaveis de ambiente (frontend)

Arquivo base: `apps/frontend/.env.example`

No estado atual do frontend, nao ha variaveis obrigatorias para execucao local.
As variaveis `VITE_*` podem ser usadas futuramente para integracoes publicas.

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
