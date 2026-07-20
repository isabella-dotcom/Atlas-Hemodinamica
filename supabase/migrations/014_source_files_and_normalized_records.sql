-- 014: arquivos de fonte e registros normalizados intermediários
-- Depende de: 013_ingestion_jobs.sql

create type public.source_file_status as enum (
  'discovered',
  'downloading',
  'stored',
  'processing',
  'processed',
  'failed',
  'skipped_duplicate'
);

create table if not exists public.source_files (
  id uuid primary key default gen_random_uuid(),
  source_code text not null,
  source_url text,
  original_filename text not null,
  storage_path text,
  file_hash text,
  file_size bigint,
  mime_type text,
  state_uf char(2),
  competence text,
  downloaded_at timestamptz,
  processed_at timestamptz,
  status public.source_file_status not null default 'discovered',
  metadata jsonb not null default '{}'::jsonb,
  job_id uuid references public.ingestion_jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists source_files_hash_uq
  on public.source_files (file_hash)
  where file_hash is not null
    and status not in ('failed', 'skipped_duplicate');

create index if not exists source_files_source_competence_idx
  on public.source_files (source_code, competence, state_uf);
create index if not exists source_files_job_idx
  on public.source_files (job_id);

drop trigger if exists source_files_updated_at on public.source_files;
create trigger source_files_updated_at
before update on public.source_files
for each row execute function public.set_updated_at();

create type public.normalized_record_status as enum (
  'pending',
  'valid',
  'invalid',
  'matched',
  'loaded',
  'skipped'
);

create table if not exists public.normalized_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ingestion_jobs (id) on delete set null,
  source_file_id uuid references public.source_files (id) on delete set null,
  entity_type text not null,
  source_record_id text,
  normalized_data jsonb not null default '{}'::jsonb,
  raw_record_id uuid references public.raw_records (id) on delete set null,
  validation_errors jsonb not null default '[]'::jsonb,
  status public.normalized_record_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists normalized_records_job_idx
  on public.normalized_records (job_id);
create index if not exists normalized_records_entity_idx
  on public.normalized_records (entity_type, status);
create index if not exists normalized_records_source_record_idx
  on public.normalized_records (entity_type, source_record_id);

comment on table public.source_files is
  'Arquivos oficiais preservados (hash, URL, competência). Bucket privado imports.';
comment on table public.normalized_records is
  'Camada normalizada independente do formato CNES. Nunca escreve em GOLDEN.';
