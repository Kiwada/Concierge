# concicerge

Repositorio principal do projeto Concierge, organizado como monorepo simples para crescer sem bagunca.

## Estrutura

```text
concicerge/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   └── frontend/
│       ├── Dockerfile
│       ├── .env.example
│       ├── nginx/
│       ├── src/
│       └── package.json
└── README.md
```

## Convencao de branches

- `main`: producao
- `dev`: homologacao
- `feature/*`: desenvolvimento

## Rodar frontend local

```bash
cd apps/frontend
npm install
cp .env.example .env
npm run server
npm run dev
```

## CI

Workflow em `.github/workflows/ci.yml`:

- executa em `push` e `pull_request` de `main` e `dev`
- valida apenas mudancas em `apps/frontend/**`
- roda `npm ci`, `npm run lint` e `npm run build`

## Deploy no Coolify (self-hosted)

Para criar a aplicacao frontend:

- Source: este repositorio
- Branch: `main`
- Build Pack: `Dockerfile`
- Root Directory: `/apps/frontend`
- Dockerfile path: `./Dockerfile`
- Port: `80`
- Domain: `app.conciergehub.com.br`
- Force HTTPS: ligado

Variaveis de build (publicas no bundle):

- `VITE_API_URL=https://api.conciergehub.com.br`
- `VITE_WS_URL=wss://chat.conciergehub.com.br`
