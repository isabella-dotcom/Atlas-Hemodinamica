-- Atlas da Hemodinâmica — schema inicial (MVP)
-- Camadas: bruto → candidatos → base oficial
-- Nenhuma importação aprova automaticamente.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('master', 'analista', 'visualizador');

create type public.doctor_classification as enum (
  'possivel_candidato',
  'atuacao_provavel',
  'atuacao_institucional_confirmada',
  'especialista_confirmado',
  'rejeitado',
  'inativo'
);

create type public.record_layer as enum ('bruto', 'candidato', 'oficial');

create type public.crm_status as enum (
  'ativo',
  'inativo',
  'suspenso',
  'cancelado',
  'desconhecido'
);

create type public.link_status as enum (
  'ativo',
  'encerrado',
  'provisorio',
  'desconhecido'
);

create type public.review_status as enum (
  'pendente',
  'em_analise',
  'aprovado',
  'rejeitado',
  'nova_revisao'
);

create type public.import_status as enum (
  'recebido',
  'processando',
  'preview',
  'confirmado',
  'erro',
  'cancelado'
);

create type public.evidence_entity as enum (
  'doctor',
  'facility',
  'link',
  'contact',
  'registration',
  'specialty'
);

create type public.contact_channel as enum (
  'email',
  'telefone',
  'whatsapp',
  'site',
  'outro'
);

-- ---------------------------------------------------------------------------
-- Helpers genéricos (antes das tabelas)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users_profile
-- ---------------------------------------------------------------------------

create table public.users_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'visualizador',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_profile_updated_at
before update on public.users_profile
for each row execute function public.set_updated_at();

-- Helpers de autorização (após users_profile — security definer evita recursão RLS)
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users_profile
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_profile
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_profile
    where id = auth.uid()
      and is_active = true
      and role in ('master', 'analista')
  );
$$;

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_profile
    where id = auth.uid()
      and is_active = true
      and role = 'master'
  );
$$;
-- ---------------------------------------------------------------------------
-- data_sources
-- ---------------------------------------------------------------------------

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  url text,
  reliability_score integer not null default 50
    check (reliability_score between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger data_sources_updated_at
before update on public.data_sources
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- specialties
-- ---------------------------------------------------------------------------

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  is_hemodynamics_related boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- doctors
-- ---------------------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  classification public.doctor_classification not null default 'possivel_candidato',
  layer public.record_layer not null default 'candidato',
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  city text,
  state_uf char(2),
  notes text,
  last_validated_at timestamptz,
  last_validated_by uuid references public.users_profile (id),
  is_deleted boolean not null default false,
  created_by uuid references public.users_profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctors_normalized_name_idx on public.doctors (normalized_name);
create index doctors_classification_idx on public.doctors (classification);
create index doctors_layer_idx on public.doctors (layer);
create index doctors_state_uf_idx on public.doctors (state_uf);

create trigger doctors_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- medical_registrations (CRM / RQE)
-- ---------------------------------------------------------------------------

create table public.medical_registrations (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  registration_type text not null check (registration_type in ('CRM', 'RQE')),
  number text not null,
  state_uf char(2) not null,
  status public.crm_status not null default 'desconhecido',
  specialty_id uuid references public.specialties (id),
  source_id uuid references public.data_sources (id),
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  last_validated_at timestamptz,
  last_validated_by uuid references public.users_profile (id),
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_type, number, state_uf)
);

create index medical_registrations_doctor_idx
  on public.medical_registrations (doctor_id);

create trigger medical_registrations_updated_at
before update on public.medical_registrations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- doctor_specialties
-- ---------------------------------------------------------------------------

create table public.doctor_specialties (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id),
  source_id uuid references public.data_sources (id),
  is_confirmed boolean not null default false,
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (doctor_id, specialty_id)
);

-- ---------------------------------------------------------------------------
-- health_facilities
-- ---------------------------------------------------------------------------

create table public.health_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  cnes text,
  cnpj text,
  facility_type text,
  city text not null,
  state_uf char(2) not null,
  address_street text,
  address_number text,
  address_district text,
  address_zip text,
  phone text,
  email text,
  website text,
  attends_sus boolean,
  has_hemodynamics boolean not null default false,
  layer public.record_layer not null default 'candidato',
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  source_id uuid references public.data_sources (id),
  notes text,
  last_validated_at timestamptz,
  last_validated_by uuid references public.users_profile (id),
  is_deleted boolean not null default false,
  created_by uuid references public.users_profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_facilities_state_city_idx
  on public.health_facilities (state_uf, city);
create index health_facilities_hemodynamics_idx
  on public.health_facilities (has_hemodynamics)
  where has_hemodynamics = true;
create unique index health_facilities_cnes_uq
  on public.health_facilities (cnes)
  where cnes is not null;

create trigger health_facilities_updated_at
before update on public.health_facilities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- doctor_facility_links (vínculo médico ↔ estabelecimento)
-- ---------------------------------------------------------------------------

create table public.doctor_facility_links (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  facility_id uuid not null references public.health_facilities (id) on delete cascade,
  role_title text,
  department text,
  is_coordinator boolean not null default false,
  status public.link_status not null default 'desconhecido',
  started_on date,
  ended_on date,
  source_id uuid references public.data_sources (id),
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  last_validated_at timestamptz,
  last_validated_by uuid references public.users_profile (id),
  notes text,
  layer public.record_layer not null default 'candidato',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctor_facility_links_doctor_idx
  on public.doctor_facility_links (doctor_id);
create index doctor_facility_links_facility_idx
  on public.doctor_facility_links (facility_id);
create unique index doctor_facility_links_active_uq
  on public.doctor_facility_links (doctor_id, facility_id, coalesce(role_title, ''), coalesce(department, ''))
  where status <> 'encerrado';

create trigger doctor_facility_links_updated_at
before update on public.doctor_facility_links
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- professional_contacts
-- ---------------------------------------------------------------------------

create table public.professional_contacts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.doctors (id) on delete cascade,
  facility_id uuid references public.health_facilities (id) on delete cascade,
  channel public.contact_channel not null,
  value text not null,
  label text,
  is_institutional boolean not null default true,
  source_id uuid references public.data_sources (id),
  confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  last_validated_at timestamptz,
  last_validated_by uuid references public.users_profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (doctor_id is not null or facility_id is not null)
);

create trigger professional_contacts_updated_at
before update on public.professional_contacts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contact_restrictions ("não contatar")
-- ---------------------------------------------------------------------------

create table public.contact_restrictions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.doctors (id) on delete cascade,
  contact_id uuid references public.professional_contacts (id) on delete cascade,
  reason text not null,
  created_by uuid references public.users_profile (id),
  created_at timestamptz not null default now(),
  check (doctor_id is not null or contact_id is not null)
);

-- ---------------------------------------------------------------------------
-- evidences
-- ---------------------------------------------------------------------------

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  entity_type public.evidence_entity not null,
  entity_id uuid not null,
  source_id uuid references public.data_sources (id),
  title text not null,
  description text,
  url text,
  collected_at date,
  storage_path text,
  validated_by uuid references public.users_profile (id),
  validated_at timestamptz,
  created_by uuid references public.users_profile (id),
  created_at timestamptz not null default now()
);

create index evidences_entity_idx
  on public.evidences (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- import_batches / raw_records
-- ---------------------------------------------------------------------------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null,
  storage_path text,
  status public.import_status not null default 'recebido',
  source_id uuid references public.data_sources (id),
  row_count integer,
  preview_summary jsonb,
  error_message text,
  uploaded_by uuid references public.users_profile (id),
  confirmed_by uuid references public.users_profile (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_batches_updated_at
before update on public.import_batches
for each row execute function public.set_updated_at();

create table public.raw_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  row_number integer,
  payload jsonb not null,
  normalized_payload jsonb,
  match_status text not null default 'pendente',
  linked_doctor_id uuid references public.doctors (id),
  linked_facility_id uuid references public.health_facilities (id),
  error_message text,
  created_at timestamptz not null default now()
);

create index raw_records_batch_idx on public.raw_records (batch_id);

-- ---------------------------------------------------------------------------
-- review_queue
-- ---------------------------------------------------------------------------

create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.doctors (id) on delete cascade,
  facility_id uuid references public.health_facilities (id) on delete cascade,
  link_id uuid references public.doctor_facility_links (id) on delete set null,
  status public.review_status not null default 'pendente',
  priority integer not null default 50,
  duplicate_of_doctor_id uuid references public.doctors (id),
  assigned_to uuid references public.users_profile (id),
  notes text,
  decided_by uuid references public.users_profile (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (doctor_id is not null or facility_id is not null)
);

create index review_queue_status_idx on public.review_queue (status);

create trigger review_queue_updated_at
before update on public.review_queue
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users_profile (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Seed: fontes e especialidades (sem dados fictícios de médicos)
-- ---------------------------------------------------------------------------

insert into public.data_sources (code, name, description, reliability_score) values
  ('CNES', 'CNES/DATASUS', 'Cadastro Nacional de Estabelecimentos de Saúde', 85),
  ('CFM', 'CFM/CRM', 'Conselhos de Medicina', 95),
  ('SBHCI', 'SBHCI', 'Sociedade Brasileira de Hemodinâmica e Cardiologia Intervencionista', 90),
  ('HOSPITAL_SITE', 'Site institucional', 'Páginas oficiais de hospitais e corpo clínico', 70),
  ('LATTES', 'Currículo Lattes', 'Plataforma Lattes/CNPq', 65),
  ('CONGRESSO', 'Congressos e publicações', 'Listas de congressos e publicações científicas', 60),
  ('IMPORT_CSV', 'Importação CSV/Excel', 'Arquivos enviados pela equipe', 50),
  ('MANUAL', 'Cadastro manual', 'Inserção humana na aplicação', 80);

insert into public.specialties (code, name, is_hemodynamics_related) values
  ('CARDIO', 'Cardiologia', false),
  ('HEMO', 'Hemodinâmica', true),
  ('CI', 'Cardiologia Intervencionista', true),
  ('HEMOCIR', 'Hemodinâmica e Cardiologia Intervencionista', true);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.users_profile enable row level security;
alter table public.data_sources enable row level security;
alter table public.specialties enable row level security;
alter table public.doctors enable row level security;
alter table public.medical_registrations enable row level security;
alter table public.doctor_specialties enable row level security;
alter table public.health_facilities enable row level security;
alter table public.doctor_facility_links enable row level security;
alter table public.professional_contacts enable row level security;
alter table public.contact_restrictions enable row level security;
alter table public.evidences enable row level security;
alter table public.import_batches enable row level security;
alter table public.raw_records enable row level security;
alter table public.review_queue enable row level security;
alter table public.audit_logs enable row level security;

-- users_profile
create policy "users_profile_select_authenticated"
  on public.users_profile for select
  using (public.is_authenticated_user());

create policy "users_profile_update_self_or_master"
  on public.users_profile for update
  using (id = auth.uid() or public.is_master());

create policy "users_profile_insert_master"
  on public.users_profile for insert
  with check (public.is_master() or id = auth.uid());

-- Catálogos de leitura
create policy "data_sources_select" on public.data_sources for select
  using (public.is_authenticated_user());
create policy "data_sources_write" on public.data_sources for all
  using (public.is_master()) with check (public.is_master());

create policy "specialties_select" on public.specialties for select
  using (public.is_authenticated_user());
create policy "specialties_write" on public.specialties for all
  using (public.can_write()) with check (public.can_write());

-- Domínio principal: leitura autenticada, escrita analista/master
create policy "doctors_select" on public.doctors for select
  using (public.is_authenticated_user() and is_deleted = false);
create policy "doctors_insert" on public.doctors for insert
  with check (public.can_write());
create policy "doctors_update" on public.doctors for update
  using (public.can_write());
create policy "doctors_delete_master" on public.doctors for delete
  using (public.is_master());

create policy "medical_registrations_select" on public.medical_registrations for select
  using (public.is_authenticated_user());
create policy "medical_registrations_write" on public.medical_registrations for all
  using (public.can_write()) with check (public.can_write());

create policy "doctor_specialties_select" on public.doctor_specialties for select
  using (public.is_authenticated_user());
create policy "doctor_specialties_write" on public.doctor_specialties for all
  using (public.can_write()) with check (public.can_write());

create policy "health_facilities_select" on public.health_facilities for select
  using (public.is_authenticated_user() and is_deleted = false);
create policy "health_facilities_insert" on public.health_facilities for insert
  with check (public.can_write());
create policy "health_facilities_update" on public.health_facilities for update
  using (public.can_write());
create policy "health_facilities_delete_master" on public.health_facilities for delete
  using (public.is_master());

create policy "doctor_facility_links_select" on public.doctor_facility_links for select
  using (public.is_authenticated_user());
create policy "doctor_facility_links_write" on public.doctor_facility_links for all
  using (public.can_write()) with check (public.can_write());

create policy "professional_contacts_select" on public.professional_contacts for select
  using (public.is_authenticated_user());
create policy "professional_contacts_write" on public.professional_contacts for all
  using (public.can_write()) with check (public.can_write());

create policy "contact_restrictions_select" on public.contact_restrictions for select
  using (public.is_authenticated_user());
create policy "contact_restrictions_write" on public.contact_restrictions for all
  using (public.can_write()) with check (public.can_write());

create policy "evidences_select" on public.evidences for select
  using (public.is_authenticated_user());
create policy "evidences_write" on public.evidences for all
  using (public.can_write()) with check (public.can_write());

create policy "import_batches_select" on public.import_batches for select
  using (public.is_authenticated_user());
create policy "import_batches_write" on public.import_batches for all
  using (public.can_write()) with check (public.can_write());

create policy "raw_records_select" on public.raw_records for select
  using (public.is_authenticated_user());
create policy "raw_records_write" on public.raw_records for all
  using (public.can_write()) with check (public.can_write());

create policy "review_queue_select" on public.review_queue for select
  using (public.is_authenticated_user());
create policy "review_queue_write" on public.review_queue for all
  using (public.can_write()) with check (public.can_write());

create policy "audit_logs_select" on public.audit_logs for select
  using (public.is_master() or public.can_write());
create policy "audit_logs_insert" on public.audit_logs for insert
  with check (public.is_authenticated_user());

-- ---------------------------------------------------------------------------
-- Storage bucket (evidências / importações) — criar no painel ou via API
-- bucket privado: evidences, imports
-- ---------------------------------------------------------------------------
