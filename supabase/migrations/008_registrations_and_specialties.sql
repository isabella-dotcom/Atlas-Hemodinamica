-- 008: registros profissionais (CRM/RQE) e catálogo de especialidades
-- Preserva medical_registrations; não cria tabela paralela de CRM/RQE.

-- ---------------------------------------------------------------------------
-- Enum de status de verificação do registro
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'registration_verification_status'
      and n.nspname = 'public'
  ) then
    create type public.registration_verification_status as enum (
      'nao_verificado',
      'em_verificacao',
      'verificado',
      'divergente',
      'invalido'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Colunas aditivas em medical_registrations
-- ---------------------------------------------------------------------------

alter table public.medical_registrations
  add column if not exists inscription_type text,
  add column if not exists consulted_at date,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_status public.registration_verification_status
    not null default 'nao_verificado',
  add column if not exists registration_details text,
  add column if not exists rqe_area text,
  add column if not exists rqe_status text;

comment on column public.medical_registrations.inscription_type is
  'Tipo de inscrição (principal, secundária, provisória, etc.).';
comment on column public.medical_registrations.consulted_at is
  'Data da consulta à fonte (CRM/CFM/site).';
comment on column public.medical_registrations.rqe_area is
  'Área/especialidade do RQE quando distinta do specialty_id.';
comment on column public.medical_registrations.rqe_status is
  'Situação textual do RQE quando informada pela fonte.';

create index if not exists medical_registrations_verification_idx
  on public.medical_registrations (verification_status);

create index if not exists medical_registrations_consulted_at_idx
  on public.medical_registrations (consulted_at)
  where consulted_at is not null;

-- ---------------------------------------------------------------------------
-- Especialidades — seed idempotente (ON CONFLICT DO NOTHING)
-- Cardiologia e Hemodinâmica+CI já existem na 001; upsert por code/name.
-- ---------------------------------------------------------------------------

insert into public.specialties (code, name, is_hemodynamics_related)
values
  ('HEMOCI', 'Hemodinâmica e Cardiologia Intervencionista', true),
  ('CARDIO', 'Cardiologia', false),
  ('VASC', 'Cirurgia Vascular', false),
  ('RADIO_INT', 'Radiologia Intervencionista', true),
  ('NEURO_INT', 'Neurorradiologia Intervencionista', true),
  ('ELETRO', 'Eletrofisiologia', true)
on conflict (name) do update
set
  code = coalesce(public.specialties.code, excluded.code),
  is_hemodynamics_related = public.specialties.is_hemodynamics_related
    or excluded.is_hemodynamics_related;

-- Garante code único quando name já existia com outro code (HEMOCIR vs HEMOCI)
insert into public.specialties (code, name, is_hemodynamics_related)
values ('HEMOCIR', 'Hemodinâmica e Cardiologia Intervencionista', true)
on conflict (name) do nothing;
