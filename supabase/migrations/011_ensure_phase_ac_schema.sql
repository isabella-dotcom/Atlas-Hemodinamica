-- 011: garantia idempotente do schema da Fase A–C
-- Causa raiz típica de colunas ausentes: 007–010 ainda não aplicadas no projeto Supabase.
-- Esta migration pode ser executada mesmo se 007–010 já rodaram (IF NOT EXISTS).
-- NÃO edita 001–010. NÃO remove/renomeia colunas.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

alter type public.doctor_classification add value if not exists 'falecido';
alter type public.doctor_classification add value if not exists 'registro_duplicado';

alter type public.contact_channel add value if not exists 'celular';
alter type public.contact_channel add value if not exists 'secretaria';
alter type public.contact_channel add value if not exists 'formulario';
alter type public.contact_channel add value if not exists 'linkedin';

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'registration_verification_status'
  ) then
    create type public.registration_verification_status as enum (
      'nao_verificado',
      'em_verificacao',
      'verificado',
      'divergente',
      'invalido'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'contact_status'
  ) then
    create type public.contact_status as enum (
      'nao_validado',
      'valido',
      'invalido',
      'desatualizado'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- doctors
-- ---------------------------------------------------------------------------

alter table public.doctors add column if not exists social_name text;
alter table public.doctors add column if not exists sex text;
alter table public.doctors add column if not exists nationality text;
alter table public.doctors add column if not exists photo_path text;
alter table public.doctors add column if not exists biography text;
alter table public.doctors add column if not exists declared_practice_area text;
alter table public.doctors add column if not exists confirmed_practice_area text;
alter table public.doctors add column if not exists practice_keywords text[] not null default '{}';
alter table public.doctors add column if not exists graduation_institution text;
alter table public.doctors add column if not exists graduation_year integer;
alter table public.doctors add column if not exists residency text;
alter table public.doctors add column if not exists specialization text;
alter table public.doctors add column if not exists fellowships text[] not null default '{}';
alter table public.doctors add column if not exists masters_degree text;
alter table public.doctors add column if not exists doctorate_degree text;
alter table public.doctors add column if not exists professional_titles text[] not null default '{}';
alter table public.doctors add column if not exists medical_societies text[] not null default '{}';
alter table public.doctors add column if not exists is_sbhci_member boolean;
alter table public.doctors add column if not exists lattes_url text;
alter table public.doctors add column if not exists orcid text;
alter table public.doctors add column if not exists scientific_identifiers jsonb not null default '{}'::jsonb;
alter table public.doctors add column if not exists is_demo boolean not null default false;
alter table public.doctors add column if not exists deleted_at timestamptz;

create index if not exists doctors_is_demo_idx on public.doctors (is_demo) where is_demo = true;
create index if not exists doctors_deleted_at_idx on public.doctors (deleted_at) where deleted_at is not null;

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

-- birth_date sensível (tabela 1:1)
create table if not exists public.doctor_sensitive_fields (
  doctor_id uuid primary key references public.doctors (id) on delete cascade,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctor_sensitive_fields enable row level security;

drop policy if exists doctor_sensitive_select on public.doctor_sensitive_fields;
create policy doctor_sensitive_select on public.doctor_sensitive_fields
  for select using (public.can_write());

drop policy if exists doctor_sensitive_insert on public.doctor_sensitive_fields;
create policy doctor_sensitive_insert on public.doctor_sensitive_fields
  for insert with check (public.can_write());

drop policy if exists doctor_sensitive_update on public.doctor_sensitive_fields;
create policy doctor_sensitive_update on public.doctor_sensitive_fields
  for update using (public.can_write()) with check (public.can_write());

drop policy if exists doctor_sensitive_delete on public.doctor_sensitive_fields;
create policy doctor_sensitive_delete on public.doctor_sensitive_fields
  for delete using (public.is_master());

grant select, insert, update, delete on public.doctor_sensitive_fields to authenticated;

-- ---------------------------------------------------------------------------
-- medical_registrations
-- ---------------------------------------------------------------------------

alter table public.medical_registrations add column if not exists inscription_type text;
alter table public.medical_registrations add column if not exists consulted_at date;
alter table public.medical_registrations add column if not exists verified_at timestamptz;
alter table public.medical_registrations
  add column if not exists verification_status public.registration_verification_status
  not null default 'nao_verificado';
alter table public.medical_registrations add column if not exists registration_details text;
alter table public.medical_registrations add column if not exists rqe_area text;
alter table public.medical_registrations add column if not exists rqe_status text;

-- ---------------------------------------------------------------------------
-- health_facilities
-- (CEP/rua/bairro = address_zip / address_street / address_district — já na 001)
-- ---------------------------------------------------------------------------

alter table public.health_facilities add column if not exists normalized_name text;
alter table public.health_facilities add column if not exists legal_nature text;
alter table public.health_facilities add column if not exists ownership_type text;
alter table public.health_facilities add column if not exists branch_type text;
alter table public.health_facilities add column if not exists is_active boolean not null default true;
alter table public.health_facilities add column if not exists address_complement text;
alter table public.health_facilities add column if not exists ibge_city_code text;
alter table public.health_facilities add column if not exists region text;
alter table public.health_facilities add column if not exists latitude numeric(9, 6);
alter table public.health_facilities add column if not exists longitude numeric(9, 6);
alter table public.health_facilities add column if not exists hemodynamics_phone text;
alter table public.health_facilities add column if not exists institutional_whatsapp text;
alter table public.health_facilities add column if not exists hemodynamics_email text;
alter table public.health_facilities add column if not exists secretary_contact text;
alter table public.health_facilities add column if not exists service_manager_contact text;
alter table public.health_facilities add column if not exists has_catheterization_lab boolean;
alter table public.health_facilities add column if not exists has_interventional_cardiology boolean;
alter table public.health_facilities add column if not exists has_interventional_radiology boolean;
alter table public.health_facilities add column if not exists has_interventional_neuroradiology boolean;
alter table public.health_facilities add column if not exists attends_private boolean;
alter table public.health_facilities add column if not exists attends_insurance boolean;
alter table public.health_facilities add column if not exists is_24_hours boolean;
alter table public.health_facilities add column if not exists has_emergency_service boolean;
alter table public.health_facilities add column if not exists estimated_rooms integer;
alter table public.health_facilities add column if not exists estimated_equipment integer;
alter table public.health_facilities add column if not exists procedures text;
alter table public.health_facilities add column if not exists service_notes text;
alter table public.health_facilities add column if not exists last_service_confirmed_at timestamptz;
alter table public.health_facilities add column if not exists is_demo boolean not null default false;

update public.health_facilities
set normalized_name = public.normalize_search_text(name)
where normalized_name is null;

create index if not exists health_facilities_is_demo_idx
  on public.health_facilities (is_demo) where is_demo = true;

-- ---------------------------------------------------------------------------
-- doctor_facility_links
-- ---------------------------------------------------------------------------

alter table public.doctor_facility_links add column if not exists function_title text;
alter table public.doctor_facility_links add column if not exists practiced_specialty text;
alter table public.doctor_facility_links add column if not exists is_team_leader boolean not null default false;
alter table public.doctor_facility_links add column if not exists is_clinical_staff boolean not null default false;
alter table public.doctor_facility_links add column if not exists weekly_hours numeric(5, 2);
alter table public.doctor_facility_links add column if not exists is_sus_link boolean;
alter table public.doctor_facility_links
  add column if not exists evidence_id uuid references public.evidences (id) on delete set null;
alter table public.doctor_facility_links add column if not exists last_verified_at timestamptz;
alter table public.doctor_facility_links
  add column if not exists verified_by uuid references public.users_profile (id);

-- ---------------------------------------------------------------------------
-- professional_contacts
-- ---------------------------------------------------------------------------

alter table public.professional_contacts
  add column if not exists contact_status public.contact_status not null default 'nao_validado';
alter table public.professional_contacts add column if not exists accepts_contact boolean;
alter table public.professional_contacts add column if not exists source_origin text;
alter table public.professional_contacts add column if not exists collected_at date;
alter table public.professional_contacts add column if not exists last_attempt_at timestamptz;
alter table public.professional_contacts add column if not exists last_attempt_result text;
alter table public.professional_contacts add column if not exists verified_at timestamptz;
alter table public.professional_contacts
  add column if not exists verified_by uuid references public.users_profile (id);

-- RLS contatos (visualizador)
drop policy if exists "professional_contacts_select" on public.professional_contacts;
create policy "professional_contacts_select"
  on public.professional_contacts
  for select
  using (
    public.is_authenticated_user()
    and is_deleted = false
    and (
      public.can_write()
      or (
        do_not_contact = false
        and is_publicly_available = true
        and contact_status <> 'invalido'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Especialidades (idempotente)
-- ---------------------------------------------------------------------------

insert into public.specialties (code, name, is_hemodynamics_related)
values
  ('HEMOCIR', 'Hemodinâmica e Cardiologia Intervencionista', true),
  ('CARDIO', 'Cardiologia', false),
  ('VASC', 'Cirurgia Vascular', false),
  ('RADIO_INT', 'Radiologia Intervencionista', true),
  ('NEURO_INT', 'Neurorradiologia Intervencionista', true),
  ('ELETRO', 'Eletrofisiologia', true)
on conflict (name) do nothing;

insert into public.data_sources (code, name, description, reliability_score, is_active)
values (
  'DEMO',
  'Dados fictícios de demonstração',
  'Fonte exclusiva para seed. Nunca misturar com base oficial.',
  10,
  true
)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- RPC de diagnóstico Fase A–C (Master)
-- ---------------------------------------------------------------------------

create or replace function public.diagnostic_phase_ac_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_master() then
    raise exception 'Somente Master pode executar diagnostic_phase_ac_check';
  end if;

  select jsonb_build_object(
    'columns', jsonb_build_object(
      'doctors', (
        select jsonb_object_agg(c.column_name, true)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'doctors'
          and c.column_name in (
            'social_name','biography','declared_practice_area','confirmed_practice_area',
            'graduation_institution','graduation_year','is_sbhci_member','lattes_url',
            'orcid','is_demo','deleted_at','fellowships','scientific_identifiers'
          )
      ),
      'medical_registrations', (
        select jsonb_object_agg(c.column_name, true)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'medical_registrations'
          and c.column_name in (
            'inscription_type','consulted_at','verification_status','rqe_area','rqe_status'
          )
      ),
      'health_facilities', (
        select jsonb_object_agg(c.column_name, true)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'health_facilities'
          and c.column_name in (
            'normalized_name','legal_nature','has_catheterization_lab','is_demo',
            'ownership_type','hemodynamics_phone','address_complement'
          )
      ),
      'doctor_facility_links', (
        select jsonb_object_agg(c.column_name, true)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'doctor_facility_links'
          and c.column_name in (
            'function_title','is_team_leader','weekly_hours','is_clinical_staff','is_sus_link'
          )
      ),
      'professional_contacts', (
        select jsonb_object_agg(c.column_name, true)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'professional_contacts'
          and c.column_name in (
            'contact_status','accepts_contact','collected_at','source_origin'
          )
      )
    ),
    'enums', jsonb_build_object(
      'doctor_classification_has_falecido', exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'doctor_classification'
          and e.enumlabel = 'falecido'
      ),
      'doctor_classification_has_registro_duplicado', exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'doctor_classification'
          and e.enumlabel = 'registro_duplicado'
      ),
      'contact_status_exists', exists (
        select 1 from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'contact_status'
      )
    ),
    'specialties_count', (select count(*)::int from public.specialties),
    'demo_counts', jsonb_build_object(
      'doctors', (select count(*)::int from public.doctors where is_demo = true),
      'facilities', (select count(*)::int from public.health_facilities where is_demo = true)
    ),
    'sensitive_table', to_regclass('public.doctor_sensitive_fields') is not null
  ) into result;

  return result;
end;
$$;

revoke all on function public.diagnostic_phase_ac_check() from public;
grant execute on function public.diagnostic_phase_ac_check() to authenticated;

comment on function public.diagnostic_phase_ac_check is
  'Verifica colunas/enums da Fase A–C. Somente Master.';
