-- 012: enriquecimento do fluxo de importação (RAW → candidato → fila)
-- Aditivo e idempotente. Não altera auth.

alter table public.import_batches
  add column if not exists file_hash text,
  add column if not exists entity_type text,
  add column if not exists competencia text,
  add column if not exists state_uf char(2),
  add column if not exists encoding text,
  add column if not exists delimiter text,
  add column if not exists column_mapping jsonb not null default '{}'::jsonb,
  add column if not exists valid_count integer not null default 0,
  add column if not exists invalid_count integer not null default 0,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists doctors_found integer not null default 0,
  add column if not exists facilities_found integer not null default 0,
  add column if not exists links_found integer not null default 0,
  add column if not exists contacts_found integer not null default 0,
  add column if not exists evidences_found integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_finished_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.users_profile (id),
  add column if not exists reprocessed_from uuid references public.import_batches (id),
  add column if not exists error_report jsonb;

comment on column public.import_batches.file_hash is
  'SHA-256 do arquivo. Usado para impedir duplicidade de upload.';
comment on column public.import_batches.entity_type is
  'doctors | facilities | registrations | links | contacts | evidences';

create unique index if not exists import_batches_file_hash_active_uq
  on public.import_batches (file_hash)
  where file_hash is not null
    and status not in ('cancelado', 'erro');

create index if not exists import_batches_entity_type_idx
  on public.import_batches (entity_type);

create index if not exists import_batches_uploaded_by_idx
  on public.import_batches (uploaded_by);

alter table public.raw_records
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists is_valid boolean,
  add column if not exists is_duplicate boolean not null default false;

-- Fonte planilha interna (idempotente)
insert into public.data_sources (code, name, description, reliability_score, is_active)
values
  ('IMPORT_CSV', 'Importação CSV/XLSX', 'Planilhas internas importadas via /importacoes', 40, true),
  ('PLANILHA_INTERNA', 'Planilha interna', 'Planilha operacional fornecida pela equipe', 45, true),
  ('CRM_ESTADUAL', 'CRM estadual', 'Consulta/registro estadual de CRM (manual)', 70, true),
  ('CONTATO_DIRETO', 'Contato direto', 'Informação obtida por contato direto documentado', 55, true),
  ('SITE_INSTITUCIONAL', 'Site institucional', 'Página oficial de hospital/clínica', 50, true),
  ('CLINICA', 'Clínica', 'Informação de clínica (manual/documentada)', 50, true),
  ('HOSPITAL', 'Hospital', 'Informação hospitalar documentada', 55, true),
  ('PUBLICACAO_CIENTIFICA', 'Publicação científica', 'Artigo ou lista científica (manual)', 60, true)
on conflict (code) do nothing;
