# Backend worker

## Local

```bash
cd etl
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
set SUPABASE_URL=...
set SUPABASE_SERVICE_ROLE_KEY=...
python cli.py process-queue --limit 5
python cli.py discover-cnes --state-uf MG --competence 2026-06
python cli.py ingest-fixture --fixture tests/fixtures/facilities_ficticias.csv --state-uf MG
```

## Docker

```bash
cd etl
docker compose up --build
```

## CLI

- `process-queue` — drena `ingestion_jobs` queued
- `run-job --job-id` — processa um job
- `discover-cnes` — só descoberta
- `ingest-fixture` — offline com CSV fictício
