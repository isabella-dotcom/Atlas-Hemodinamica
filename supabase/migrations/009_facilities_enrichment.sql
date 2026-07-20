-- 009: enriquecimento de estabelecimentos (aditivo)
--
-- Mapeamento de endereço (NÃO duplicar colunas existentes):
--   street          → address_street   (já existe na 001)
--   postal_code     → address_zip      (já existe na 001)
--   neighborhood    → address_district (já existe na 001)
--   address_number  → address_number   (já existe na 001)
-- Novos: address_complement, normalized_name, geolocalização, flags assistenciais.

alter table public.health_facilities
  add column if not exists normalized_name text,
  add column if not exists legal_nature text,
  add column if not exists ownership_type text
    check (
      ownership_type is null
      or ownership_type in ('publico', 'privado', 'filantropico', 'misto')
    ),
  add column if not exists branch_type text
    check (
      branch_type is null
      or branch_type in ('matriz', 'filial', 'unico')
    ),
  add column if not exists is_active boolean not null default true,
  add column if not exists address_complement text,
  add column if not exists ibge_city_code text,
  add column if not exists region text,
  add column if not exists latitude numeric(9, 6)
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add column if not exists longitude numeric(9, 6)
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  add column if not exists hemodynamics_phone text,
  add column if not exists institutional_whatsapp text,
  add column if not exists hemodynamics_email text,
  add column if not exists secretary_contact text,
  add column if not exists service_manager_contact text,
  add column if not exists has_catheterization_lab boolean,
  add column if not exists has_interventional_cardiology boolean,
  add column if not exists has_interventional_radiology boolean,
  add column if not exists has_interventional_neuroradiology boolean,
  add column if not exists attends_private boolean,
  add column if not exists attends_insurance boolean,
  add column if not exists is_24_hours boolean,
  add column if not exists has_emergency_service boolean,
  add column if not exists estimated_rooms integer
    check (estimated_rooms is null or estimated_rooms >= 0),
  add column if not exists estimated_equipment integer
    check (estimated_equipment is null or estimated_equipment >= 0),
  add column if not exists procedures text,
  add column if not exists service_notes text,
  add column if not exists last_service_confirmed_at timestamptz,
  add column if not exists is_demo boolean not null default false;

comment on column public.health_facilities.normalized_name is
  'Nome normalizado para busca; preenchido pela aplicação.';
comment on column public.health_facilities.address_complement is
  'Complemento. Rua/CEP/bairro/número: address_street, address_zip, address_district, address_number.';
comment on column public.health_facilities.is_demo is
  'Marca estabelecimentos fictícios de desenvolvimento/homologação.';

-- Backfill normalized_name a partir do name existente
update public.health_facilities
set normalized_name = public.normalize_search_text(name)
where normalized_name is null;

create index if not exists health_facilities_normalized_name_idx
  on public.health_facilities (normalized_name);

create index if not exists health_facilities_normalized_name_trgm_idx
  on public.health_facilities
  using gin (normalized_name extensions.gin_trgm_ops);

create index if not exists health_facilities_ibge_idx
  on public.health_facilities (ibge_city_code)
  where ibge_city_code is not null;

create index if not exists health_facilities_is_active_idx
  on public.health_facilities (is_active);

create index if not exists health_facilities_is_demo_idx
  on public.health_facilities (is_demo)
  where is_demo = true;

create index if not exists health_facilities_ownership_idx
  on public.health_facilities (ownership_type)
  where ownership_type is not null;
