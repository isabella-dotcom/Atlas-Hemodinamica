-- 017: RLS e RPCs para ingestão automática
-- Depende de: 013–016 e helpers can_write / is_master / current_user_role (001/003)

alter table public.ingestion_jobs enable row level security;
alter table public.ingestion_job_logs enable row level security;
alter table public.source_files enable row level security;
alter table public.normalized_records enable row level security;
alter table public.matching_results enable row level security;
alter table public.source_observations enable row level security;
alter table public.manual_field_overrides enable row level security;
alter table public.sync_states enable row level security;

drop policy if exists "ingestion_jobs_select" on public.ingestion_jobs;
create policy "ingestion_jobs_select" on public.ingestion_jobs
for select to authenticated
using (
  public.can_write()
  or status in ('completed', 'partial')
);

drop policy if exists "ingestion_jobs_write" on public.ingestion_jobs;
create policy "ingestion_jobs_write" on public.ingestion_jobs
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "ingestion_job_logs_select" on public.ingestion_job_logs;
create policy "ingestion_job_logs_select" on public.ingestion_job_logs
for select to authenticated
using (
  public.can_write()
  or exists (
    select 1 from public.ingestion_jobs j
    where j.id = job_id and j.status in ('completed', 'partial')
  )
);

drop policy if exists "ingestion_job_logs_write" on public.ingestion_job_logs;
create policy "ingestion_job_logs_write" on public.ingestion_job_logs
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "source_files_select" on public.source_files;
create policy "source_files_select" on public.source_files
for select to authenticated
using (public.can_write());

drop policy if exists "source_files_write" on public.source_files;
create policy "source_files_write" on public.source_files
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "normalized_records_select" on public.normalized_records;
create policy "normalized_records_select" on public.normalized_records
for select to authenticated
using (public.can_write());

drop policy if exists "normalized_records_write" on public.normalized_records;
create policy "normalized_records_write" on public.normalized_records
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "matching_results_select" on public.matching_results;
create policy "matching_results_select" on public.matching_results
for select to authenticated
using (public.can_write());

drop policy if exists "matching_results_write" on public.matching_results;
create policy "matching_results_write" on public.matching_results
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "source_observations_select" on public.source_observations;
create policy "source_observations_select" on public.source_observations
for select to authenticated
using (
  public.can_write()
  or exists (
    select 1 from public.doctors d
    where d.id = entity_id and entity_type = 'doctor' and d.layer = 'oficial' and not d.is_deleted
  )
  or exists (
    select 1 from public.health_facilities f
    where f.id = entity_id and entity_type = 'facility' and f.layer = 'oficial' and not f.is_deleted
  )
);

drop policy if exists "source_observations_write" on public.source_observations;
create policy "source_observations_write" on public.source_observations
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "manual_field_overrides_select" on public.manual_field_overrides;
create policy "manual_field_overrides_select" on public.manual_field_overrides
for select to authenticated
using (public.can_write());

drop policy if exists "manual_field_overrides_write" on public.manual_field_overrides;
create policy "manual_field_overrides_write" on public.manual_field_overrides
for all to authenticated
using (public.can_write())
with check (public.can_write());

drop policy if exists "sync_states_select" on public.sync_states;
create policy "sync_states_select" on public.sync_states
for select to authenticated
using (true);

drop policy if exists "sync_states_write" on public.sync_states;
create policy "sync_states_write" on public.sync_states
for all to authenticated
using (public.can_write())
with check (public.can_write());

create or replace function public.enqueue_ingestion_job(
  p_job_type text,
  p_source_code text,
  p_state_uf text default null,
  p_competence text default null,
  p_parameters jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if not public.can_write() then
    raise exception 'Somente master/analista podem iniciar ingestão';
  end if;

  insert into public.ingestion_jobs (
    job_type, source_code, state_uf, competence, status, requested_by, parameters
  ) values (
    p_job_type,
    p_source_code,
    nullif(upper(trim(p_state_uf)), ''),
    nullif(trim(p_competence), ''),
    'queued',
    v_uid,
    coalesce(p_parameters, '{}'::jsonb)
  )
  returning id into v_id;

  insert into public.ingestion_job_logs (job_id, level, step, message, context)
  values (
    v_id, 'info', 'enqueue',
    'Job enfileirado — aguardando worker (GitHub Actions / ETL)',
    jsonb_build_object('job_type', p_job_type, 'source_code', p_source_code)
  );

  return v_id;
end;
$$;

revoke all on function public.enqueue_ingestion_job(text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_ingestion_job(text, text, text, text, jsonb) to authenticated;

create or replace function public.cancel_ingestion_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_write() then
    raise exception 'Sem permissão';
  end if;

  update public.ingestion_jobs
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      finished_at = now(),
      current_step = 'cancelled'
  where id = p_job_id
    and status not in ('completed', 'cancelled', 'failed');

  insert into public.ingestion_job_logs (job_id, level, step, message)
  values (p_job_id, 'warning', 'cancel', 'Job cancelado pelo usuário');

  return found;
end;
$$;

revoke all on function public.cancel_ingestion_job(uuid) from public;
grant execute on function public.cancel_ingestion_job(uuid) to authenticated;

create or replace function public.diagnostic_ingestion_check()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_master() then
    raise exception 'Somente Master';
  end if;

  return jsonb_build_object(
    'tables', jsonb_build_object(
      'ingestion_jobs', to_regclass('public.ingestion_jobs') is not null,
      'ingestion_job_logs', to_regclass('public.ingestion_job_logs') is not null,
      'source_files', to_regclass('public.source_files') is not null,
      'normalized_records', to_regclass('public.normalized_records') is not null,
      'matching_results', to_regclass('public.matching_results') is not null,
      'source_observations', to_regclass('public.source_observations') is not null,
      'manual_field_overrides', to_regclass('public.manual_field_overrides') is not null,
      'sync_states', to_regclass('public.sync_states') is not null
    ),
    'queued_jobs', (select count(*) from public.ingestion_jobs where status = 'queued'),
    'failed_jobs', (select count(*) from public.ingestion_jobs where status = 'failed'),
    'running_jobs', (
      select count(*) from public.ingestion_jobs
      where status not in ('queued', 'completed', 'failed', 'cancelled', 'partial')
    ),
    'note', 'Worker usa SUPABASE_SERVICE_ROLE_KEY apenas no backend/GitHub Actions'
  );
end;
$$;

revoke all on function public.diagnostic_ingestion_check() from public;
grant execute on function public.diagnostic_ingestion_check() to authenticated;

insert into public.data_sources (code, name, description, reliability_score, is_active, url)
values
  ('CNES', 'CNES/DATASUS', 'Cadastro Nacional de Estabelecimentos de Saúde — arquivos oficiais', 85, true,
   'https://datasus.saude.gov.br/transferencia-de-arquivos/'),
  ('OPENDATASUS', 'OpenDataSUS', 'Portal de dados abertos do SUS', 80, true,
   'https://opendatasus.saude.gov.br/'),
  ('SIA_SUS', 'SIA/SUS', 'Produção ambulatorial (adapter opcional, desativado por padrão)', 70, false,
   'https://datasus.saude.gov.br/'),
  ('SIH_SUS', 'SIH/SUS', 'Produção hospitalar (adapter opcional, desativado por padrão)', 70, false,
   'https://datasus.saude.gov.br/')
on conflict (code) do update
set description = excluded.description,
    url = coalesce(excluded.url, public.data_sources.url);
