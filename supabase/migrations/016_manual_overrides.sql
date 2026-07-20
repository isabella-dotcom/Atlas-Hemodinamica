-- 016: overrides manuais por campo (preserva edições humanas)
-- Depende de: 015_matching_and_source_observations.sql

create table if not exists public.manual_field_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  override_value jsonb,
  reason text not null,
  overridden_by uuid not null references public.users_profile (id),
  overridden_at timestamptz not null default now(),
  is_active boolean not null default true,
  removed_by uuid references public.users_profile (id),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_field_overrides_active_uq
  on public.manual_field_overrides (entity_type, entity_id, field_name)
  where is_active = true;

create index if not exists manual_field_overrides_entity_idx
  on public.manual_field_overrides (entity_type, entity_id);

drop trigger if exists manual_field_overrides_updated_at on public.manual_field_overrides;
create trigger manual_field_overrides_updated_at
before update on public.manual_field_overrides
for each row execute function public.set_updated_at();

-- Metadados de sincronização em entidades existentes (aditivo)
alter table public.doctors
  add column if not exists primary_source_code text,
  add column if not exists source_competence text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists auto_extracted boolean not null default false;

alter table public.health_facilities
  add column if not exists primary_source_code text,
  add column if not exists source_competence text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists auto_extracted boolean not null default false;

comment on table public.manual_field_overrides is
  'Valor oficial mantido pelo usuário. Atualizações de fonte geram observação, não overwrite.';
comment on column public.doctors.auto_extracted is
  'true quando criado/atualizado por ingestão automática (camada candidato).';
