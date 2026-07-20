-- 007: enriquecimento do perfil do médico (aditivo)
-- NÃO altera search_doctors (assinatura e colunas de retorno preservadas).
--
-- Relação is_deleted ↔ deleted_at:
--   - is_deleted permanece a flag canônica usada por RLS, busca e archive.
--   - deleted_at é espelho opcional da exclusão lógica (timestamptz).
--   - Trigger sync_doctor_deleted_at mantém consistência:
--       is_deleted = true  → deleted_at = coalesce(deleted_at, now())
--       is_deleted = false → deleted_at = null
--
-- birth_date:
--   Armazenado em doctor_sensitive_fields (1:1), NÃO em doctors.
--   Motivo: PostgREST/Supabase usa um único role `authenticated`; RLS é
--   row-level e não mascara colunas. Tabela separada permite SELECT apenas
--   para can_write() (master/analista). Visualizador nunca lê birth_date.

-- ---------------------------------------------------------------------------
-- Classificações novas
-- ---------------------------------------------------------------------------

alter type public.doctor_classification add value if not exists 'falecido';
alter type public.doctor_classification add value if not exists 'registro_duplicado';

-- ---------------------------------------------------------------------------
-- Colunas aditivas em doctors
-- ---------------------------------------------------------------------------

alter table public.doctors
  add column if not exists social_name text,
  add column if not exists sex text
    check (sex is null or sex in ('F', 'M', 'X', 'NI')),
  add column if not exists nationality text,
  add column if not exists photo_path text,
  add column if not exists biography text,
  add column if not exists declared_practice_area text,
  add column if not exists confirmed_practice_area text,
  add column if not exists practice_keywords text[] not null default '{}',
  add column if not exists graduation_institution text,
  add column if not exists graduation_year integer
    check (
      graduation_year is null
      or (graduation_year >= 1950 and graduation_year <= extract(year from current_date)::integer + 1)
    ),
  add column if not exists residency text,
  add column if not exists specialization text,
  add column if not exists fellowships text[] not null default '{}',
  add column if not exists masters_degree text,
  add column if not exists doctorate_degree text,
  add column if not exists professional_titles text[] not null default '{}',
  add column if not exists medical_societies text[] not null default '{}',
  add column if not exists is_sbhci_member boolean,
  add column if not exists lattes_url text,
  add column if not exists orcid text
    check (
      orcid is null
      or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9Xx]$'
    ),
  add column if not exists scientific_identifiers jsonb not null default '{}'::jsonb,
  add column if not exists is_demo boolean not null default false,
  add column if not exists deleted_at timestamptz;

comment on column public.doctors.deleted_at is
  'Espelho de exclusão lógica. Canônico: is_deleted. Sincronizado por trigger.';
comment on column public.doctors.is_demo is
  'Marca registros fictícios de desenvolvimento/homologação. Nunca misturar com oficial.';
comment on column public.doctors.scientific_identifiers is
  'Identificadores científicos adicionais (ex.: {"scopus":"...","researcher_id":"..."}).';

create index if not exists doctors_is_demo_idx
  on public.doctors (is_demo)
  where is_demo = true;

create index if not exists doctors_deleted_at_idx
  on public.doctors (deleted_at)
  where deleted_at is not null;

create index if not exists doctors_orcid_idx
  on public.doctors (orcid)
  where orcid is not null;

-- ---------------------------------------------------------------------------
-- Sync is_deleted ↔ deleted_at
-- ---------------------------------------------------------------------------

create or replace function public.sync_doctor_deleted_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_deleted = true then
    new.deleted_at := coalesce(new.deleted_at, now());
  else
    new.deleted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists doctors_sync_deleted_at on public.doctors;
create trigger doctors_sync_deleted_at
before insert or update of is_deleted, deleted_at
on public.doctors
for each row execute function public.sync_doctor_deleted_at();

-- Backfill deleted_at a partir de is_deleted / archived_at
update public.doctors
set deleted_at = coalesce(archived_at, created_at)
where is_deleted = true
  and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Dados sensíveis (birth_date) — RLS restrito a writers
-- ---------------------------------------------------------------------------

create table if not exists public.doctor_sensitive_fields (
  doctor_id uuid primary key references public.doctors (id) on delete cascade,
  birth_date date
    check (birth_date is null or birth_date <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.doctor_sensitive_fields is
  'Campos sensíveis do médico. birth_date acessível apenas a master/analista (can_write).';

drop trigger if exists doctor_sensitive_fields_updated_at on public.doctor_sensitive_fields;
create trigger doctor_sensitive_fields_updated_at
before update on public.doctor_sensitive_fields
for each row execute function public.set_updated_at();

alter table public.doctor_sensitive_fields enable row level security;

drop policy if exists doctor_sensitive_select on public.doctor_sensitive_fields;
create policy doctor_sensitive_select
  on public.doctor_sensitive_fields
  for select
  using (public.can_write());

drop policy if exists doctor_sensitive_insert on public.doctor_sensitive_fields;
create policy doctor_sensitive_insert
  on public.doctor_sensitive_fields
  for insert
  with check (public.can_write());

drop policy if exists doctor_sensitive_update on public.doctor_sensitive_fields;
create policy doctor_sensitive_update
  on public.doctor_sensitive_fields
  for update
  using (public.can_write())
  with check (public.can_write());

drop policy if exists doctor_sensitive_delete on public.doctor_sensitive_fields;
create policy doctor_sensitive_delete
  on public.doctor_sensitive_fields
  for delete
  using (public.is_master());

grant select, insert, update, delete on public.doctor_sensitive_fields to authenticated;
