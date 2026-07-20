-- 013: jobs de ingestão automática (RAW → candidato)
-- Depende de: 001–012 (em especial data_sources, users_profile, import_batches).
-- Idempotente. Não promove para GOLDEN.

create type public.ingestion_job_status as enum (
  'queued',
  'discovering',
  'downloading',
  'parsing',
  'normalizing',
  'matching',
  'loading',
  'completed',
  'failed',
  'cancelled',
  'partial'
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  source_code text not null,
  state_uf char(2),
  competence text,
  status public.ingestion_job_status not null default 'queued',
  progress_percentage integer not null default 0
    check (progress_percentage between 0 and 100),
  current_step text,
  requested_by uuid references public.users_profile (id),
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users_profile (id),
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingestion_jobs_status_idx
  on public.ingestion_jobs (status);
create index if not exists ingestion_jobs_source_idx
  on public.ingestion_jobs (source_code, state_uf, competence);
create index if not exists ingestion_jobs_requested_by_idx
  on public.ingestion_jobs (requested_by);
create index if not exists ingestion_jobs_created_at_idx
  on public.ingestion_jobs (created_at desc);

drop trigger if exists ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute function public.set_updated_at();

create table if not exists public.ingestion_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ingestion_jobs (id) on delete cascade,
  level text not null default 'info'
    check (level in ('debug', 'info', 'warning', 'error')),
  step text,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_job_logs_job_idx
  on public.ingestion_job_logs (job_id, created_at);

create table if not exists public.sync_states (
  source_code text not null,
  state_uf char(2) not null default '--',
  last_discovered_competence text,
  last_processed_competence text,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (source_code, state_uf)
);

comment on table public.ingestion_jobs is
  'Fila de jobs de ingestão automática (CNES etc.). Processados fora da Vercel.';
comment on table public.sync_states is
  'Última competência descoberta/processada por fonte e UF.';
