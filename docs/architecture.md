# Architecture

## Estrutura

```text
apps/
  frontend/   -> aplicacao web
  backend/    -> API Node

supabase/
  functions/  -> edge functions de transicao
  sql/        -> schema e scripts SQL

docs/         -> documentacao tecnica
scripts/      -> automacoes de apoio
packages/     -> compartilhamento futuro
```

## Direcao

- `apps/frontend`: interface e experiencia do usuario
- `apps/backend`: autenticacao, contexto e integracoes
- `supabase`: auth, banco e SQL
- `packages`: reservado para tipos, utilitarios e UI compartilhada quando houver necessidade real
