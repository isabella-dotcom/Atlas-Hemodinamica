# GitHub Actions

Workflows:

- `.github/workflows/cnes-ingestion.yml` — manual (`workflow_dispatch`)
- `.github/workflows/cnes-scheduled-refresh.yml` — mensal
- `.github/workflows/process-ingestion-queue.yml` — a cada 6h

## Secrets (GitHub → Settings → Secrets)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca em `NEXT_PUBLIC_*`. Nunca no repositório.

## Disparo imediato (opcional Vercel)

- `GITHUB_ACTIONS_TOKEN`
- `GITHUB_REPOSITORY` (ex.: `isabella-dotcom/Atlas-Hemodinamica`)
- `GITHUB_WORKFLOW_REF` (default `cnes-ingestion.yml`)

Sem token: job fica `queued` até o schedule.
