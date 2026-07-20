-- 015: matching e observações de origem
-- Depende de: 014_source_files_and_normalized_records.sql, data_sources

create type public.match_result_type as enum (
  'novo',
  'exato',
  'provavel',
  'duplicidade_provavel',
  'conflito',
  'revisao_obrigatoria'
);

create table if not exists public.matching_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ingestion_jobs (id) on delete set null,
  entity_type text not null,
  normalized_record_id uuid references public.normalized_records (id) on delete cascade,
  matched_entity_id uuid,
  match_type public.match_result_type not null default 'novo',
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  matching_reasons jsonb not null default '[]'::jsonb,
  requires_review boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists matching_results_job_idx
  on public.matching_results (job_id);
create index if not exists matching_results_normalized_idx
  on public.matching_results (normalized_record_id);
create index if not exists matching_results_matched_idx
  on public.matching_results (entity_type, matched_entity_id);

create table if not exists public.source_observations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  observed_value jsonb,
  source_id uuid references public.data_sources (id),
  source_file_id uuid references public.source_files (id) on delete set null,
  competence text,
  confidence_score integer not null default 50
    check (confidence_score between 0 and 100),
  observed_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists source_observations_entity_idx
  on public.source_observations (entity_type, entity_id, field_name);
create index if not exists source_observations_current_idx
  on public.source_observations (entity_type, entity_id, is_current)
  where is_current = true;

-- Marca automaticamente observações anteriores do mesmo campo como não atuais
create or replace function public.mark_previous_observations_stale()
returns trigger
language plpgsql
as $$
begin
  update public.source_observations
  set is_current = false
  where entity_type = new.entity_type
    and entity_id = new.entity_id
    and field_name = new.field_name
    and id <> new.id
    and is_current = true;
  return new;
end;
$$;

drop trigger if exists source_observations_stale on public.source_observations;
create trigger source_observations_stale
after insert on public.source_observations
for each row execute function public.mark_previous_observations_stale();

comment on table public.matching_results is
  'Resultados de matching. Merge automático só com chave forte (CRM+UF / CNES).';
comment on table public.source_observations is
  'Valores observados por fonte. Não sobrescrevem overrides manuais.';
