# Concierge Frontend

Frontend baseado no esqueleto do `luz-e-cena`, preparado para deploy automático com **GitHub + Coolify + Traefik (HTTPS)**.

## Stack

- React 19
- TypeScript
- Vite
- CSS Modules
- Axios
- Docker + Nginx (produção)

## Estrutura recomendada de branches

- `main`: produção
- `dev`: homologação (staging)
- `feature/*`: desenvolvimento

## Variáveis de ambiente

Arquivo base: `.env.example`

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

Importante:

- Tudo que começa com `VITE_` fica público no bundle.
- Nunca coloque segredos reais no frontend.

## Scripts

- `npm run dev`: sobe o frontend em modo desenvolvimento
- `npm run build`: gera build de produção
- `npm run preview`: serve o build localmente
- `npm run lint`: valida qualidade de código
- `npm run server`: sobe JSON Server com `db.json` na porta `3001`

## Como rodar local

Se voce estiver na raiz do repositorio `concicerge`, entre em `apps/frontend` antes dos comandos:

```bash
cd apps/frontend
```

1. Instalar dependências:

```bash
npm install
```

2. Criar `.env` a partir do exemplo:

```bash
cp .env.example .env
```

3. Em um terminal, subir API fake:

```bash
npm run server
```

4. Em outro terminal, subir frontend:

```bash
npm run dev
```

## Build e runtime de produção

Este projeto usa Docker multi-stage:

1. Stage `builder` com Node para gerar `dist/`
2. Stage final com Nginx para servir SPA
3. Fallback de rotas SPA configurado em `nginx/default.conf` (`try_files ... /index.html`)

Arquivos principais:

- `Dockerfile`
- `nginx/default.conf`
- `.dockerignore`

## CI no GitHub

Workflow: `.github/workflows/ci.yml`

Em `push` e `pull_request` para `main`/`dev`:

- `npm ci`
- `npm run lint`
- `npm run build`

Objetivo: bloquear merge com erro antes do deploy.

## Deploy no Coolify + Traefik

### 1. Criar aplicacao no Coolify

- New Resource -> Application
- Source: GitHub repo
- Branch: `main` (produção)
- Build Pack: `Dockerfile`
- Root Directory: `/apps/frontend`
- Port: `80`
- Auto Deploy: habilitado

### 2. Variáveis no Coolify

Configure como build vars/env do app:

- `VITE_API_URL=https://api.conciergehub.com.br`
- `VITE_WS_URL=wss://chat.conciergehub.com.br`

### 3. Domínio e HTTPS

No app do Coolify:

- Domain: `app.conciergehub.com.br`
- Force HTTPS: ligado
- Certificado: automático (Let's Encrypt via Traefik)

DNS:

- Criar `A record` (`app`) apontando para IP da VPS.

### 4. Homologação (opcional)

Crie um segundo app no Coolify:

- Branch `dev`
- Domínio `staging.conciergehub.com.br`

Assim, `main` e `dev` ficam isolados.

## Operação e rollback

- Use histórico de deployments no Coolify para rollback rápido.
- Monitore logs de build/runtime direto no app.
- Endpoint de healthcheck disponível em `/healthz` no container Nginx.

## Fluxo final

`git push` -> CI (lint/build) -> Coolify build/deploy -> Traefik HTTPS
