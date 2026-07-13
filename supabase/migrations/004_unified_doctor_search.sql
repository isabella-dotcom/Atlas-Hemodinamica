-- 004: busca unificada, status de validação, contatos e evidências
-- Extensões suportadas no Supabase: unaccent, pg_trgm

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Novos enums / colunas (sem duplicar enums existentes)
-- ---------------------------------------------------------------------------

create type public.validation_status as enum (
  'nao_iniciada',
  'em_revisao',
  'parcialmente_validada',
  'validada',
  'rejeitada',
  'aguardando_informacao'
);

create type public.evidence_status as enum (
  'pendente',
  'aceita',
  'rejeitada',
  'expirada',
  'necessita_revisao'
);

alter table public.doctors
  add column if not exists validation_status public.validation_status
    not null default 'nao_iniciada',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users_profile (id),
  add column if not exists archive_reason text;

alter table public.health_facilities
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users_profile (id),
  add column if not exists archive_reason text,
  add column if not exists service_status text default 'desconhecido';

alter table public.doctor_facility_links
  add column if not exists relationship_type text,
  add column if not exists is_technical_responsible boolean not null default false,
  add column if not exists coordinator_justification text,
  add column if not exists coordinator_confirmed boolean not null default false,
  add column if not exists is_deleted boolean not null default false;

alter table public.professional_contacts
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_publicly_available boolean not null default true,
  add column if not exists is_deleted boolean not null default false;

alter table public.evidences
  add column if not exists status public.evidence_status not null default 'pendente',
  add column if not exists confirmed_field text,
  add column if not exists captured_value text,
  add column if not exists reliability_score integer
    check (reliability_score is null or reliability_score between 0 and 100),
  add column if not exists rejection_reason text;

alter table public.doctor_specialties
  add column if not exists is_primary boolean not null default false,
  add column if not exists last_validated_at timestamptz,
  add column if not exists last_validated_by uuid references public.users_profile (id);

alter table public.review_queue
  add column if not exists review_type text default 'candidato',
  add column if not exists origin text default 'manual',
  add column if not exists reason text;

-- ---------------------------------------------------------------------------
-- Índices de busca
-- ---------------------------------------------------------------------------

create index if not exists doctors_normalized_name_trgm_idx
  on public.doctors using gin (normalized_name extensions.gin_trgm_ops);

create index if not exists doctors_validation_status_idx
  on public.doctors (validation_status);

create index if not exists medical_registrations_number_idx
  on public.medical_registrations (number);

create index if not exists medical_registrations_number_trgm_idx
  on public.medical_registrations using gin (number extensions.gin_trgm_ops);

create index if not exists health_facilities_name_trgm_idx
  on public.health_facilities using gin (name extensions.gin_trgm_ops);

create index if not exists professional_contacts_doctor_idx
  on public.professional_contacts (doctor_id)
  where is_deleted = false;

create unique index if not exists professional_contacts_unique_active_uq
  on public.professional_contacts (
    coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
    channel,
    lower(value)
  )
  where is_deleted = false;

-- ---------------------------------------------------------------------------
-- Função auxiliar: normaliza texto para busca
-- ---------------------------------------------------------------------------

create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
as $$
  select trim(both from regexp_replace(
    lower(extensions.unaccent(coalesce(input, ''))),
    '\s+',
    ' ',
    'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- Busca unificada de médicos (respeita RLS via security invoker)
-- ---------------------------------------------------------------------------

create or replace function public.search_doctors(
  p_search text default null,
  p_state_uf text default null,
  p_city text default null,
  p_facility_id uuid default null,
  p_specialty_id uuid default null,
  p_classification public.doctor_classification default null,
  p_validation_status public.validation_status default null,
  p_has_rqe boolean default null,
  p_has_contact boolean default null,
  p_confidence_min integer default null,
  p_confidence_max integer default null,
  p_is_coordinator boolean default null,
  p_include_archived boolean default false,
  p_updated_recent_days integer default null,
  p_sort text default 'updated_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  normalized_name text,
  classification public.doctor_classification,
  validation_status public.validation_status,
  layer public.record_layer,
  confidence_score integer,
  city text,
  state_uf char(2),
  notes text,
  last_validated_at timestamptz,
  last_validated_by uuid,
  is_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz,
  primary_crm text,
  primary_crm_uf char(2),
  primary_rqe text,
  primary_specialty text,
  primary_facility text,
  links_count bigint,
  has_contact boolean,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_search text := public.normalize_search_text(p_search);
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_include_archived boolean := coalesce(p_include_archived, false) and public.is_master();
begin
  return query
  with base as (
    select
      d.*,
      (
        select mr.number
        from public.medical_registrations mr
        where mr.doctor_id = d.id and mr.registration_type = 'CRM'
        order by mr.is_primary desc, mr.created_at asc
        limit 1
      ) as primary_crm,
      (
        select mr.state_uf
        from public.medical_registrations mr
        where mr.doctor_id = d.id and mr.registration_type = 'CRM'
        order by mr.is_primary desc, mr.created_at asc
        limit 1
      ) as primary_crm_uf,
      (
        select mr.number
        from public.medical_registrations mr
        where mr.doctor_id = d.id and mr.registration_type = 'RQE'
        order by mr.is_primary desc, mr.created_at asc
        limit 1
      ) as primary_rqe,
      (
        select s.name
        from public.doctor_specialties ds
        join public.specialties s on s.id = ds.specialty_id
        where ds.doctor_id = d.id
        order by ds.is_primary desc, ds.is_confirmed desc, ds.created_at asc
        limit 1
      ) as primary_specialty,
      (
        select hf.name
        from public.doctor_facility_links l
        join public.health_facilities hf on hf.id = l.facility_id
        where l.doctor_id = d.id and l.is_deleted = false
        order by l.is_coordinator desc, l.updated_at desc
        limit 1
      ) as primary_facility,
      (
        select count(*)::bigint
        from public.doctor_facility_links l
        where l.doctor_id = d.id and l.is_deleted = false
      ) as links_count,
      exists (
        select 1
        from public.professional_contacts pc
        where pc.doctor_id = d.id
          and pc.is_deleted = false
          and pc.do_not_contact = false
      ) as has_contact
    from public.doctors d
    where (v_include_archived or d.is_deleted = false)
      and (p_state_uf is null or d.state_uf = upper(p_state_uf))
      and (
        p_city is null
        or public.normalize_search_text(d.city) like '%' || public.normalize_search_text(p_city) || '%'
      )
      and (p_classification is null or d.classification = p_classification)
      and (p_validation_status is null or d.validation_status = p_validation_status)
      and (p_confidence_min is null or d.confidence_score >= p_confidence_min)
      and (p_confidence_max is null or d.confidence_score <= p_confidence_max)
      and (
        p_updated_recent_days is null
        or d.updated_at >= now() - make_interval(days => p_updated_recent_days)
      )
      and (
        v_search is null or v_search = ''
        or d.normalized_name like '%' || v_search || '%'
        or public.normalize_search_text(d.full_name) like '%' || v_search || '%'
        or exists (
          select 1 from public.medical_registrations mr
          where mr.doctor_id = d.id
            and (
              public.normalize_search_text(mr.number) like '%' || v_search || '%'
              or public.normalize_search_text(mr.state_uf) = v_search
            )
        )
        or exists (
          select 1
          from public.doctor_facility_links l
          join public.health_facilities hf on hf.id = l.facility_id
          where l.doctor_id = d.id
            and l.is_deleted = false
            and (
              public.normalize_search_text(hf.name) like '%' || v_search || '%'
              or public.normalize_search_text(l.role_title) like '%' || v_search || '%'
              or public.normalize_search_text(l.department) like '%' || v_search || '%'
            )
        )
      )
      and (
        p_facility_id is null
        or exists (
          select 1 from public.doctor_facility_links l
          where l.doctor_id = d.id
            and l.facility_id = p_facility_id
            and l.is_deleted = false
        )
      )
      and (
        p_specialty_id is null
        or exists (
          select 1 from public.doctor_specialties ds
          where ds.doctor_id = d.id and ds.specialty_id = p_specialty_id
        )
      )
      and (
        p_has_rqe is null
        or (
          p_has_rqe = true and exists (
            select 1 from public.medical_registrations mr
            where mr.doctor_id = d.id and mr.registration_type = 'RQE'
          )
        )
        or (
          p_has_rqe = false and not exists (
            select 1 from public.medical_registrations mr
            where mr.doctor_id = d.id and mr.registration_type = 'RQE'
          )
        )
      )
      and (
        p_has_contact is null
        or (
          p_has_contact = true and exists (
            select 1 from public.professional_contacts pc
            where pc.doctor_id = d.id
              and pc.is_deleted = false
              and pc.do_not_contact = false
          )
        )
        or (
          p_has_contact = false and not exists (
            select 1 from public.professional_contacts pc
            where pc.doctor_id = d.id
              and pc.is_deleted = false
              and pc.do_not_contact = false
          )
        )
      )
      and (
        p_is_coordinator is null
        or exists (
          select 1 from public.doctor_facility_links l
          where l.doctor_id = d.id
            and l.is_deleted = false
            and l.is_coordinator = p_is_coordinator
        )
      )
  ),
  counted as (
    select b.*, count(*) over() as total_count
    from base b
  )
  select
    c.id,
    c.full_name,
    c.normalized_name,
    c.classification,
    c.validation_status,
    c.layer,
    c.confidence_score,
    c.city,
    c.state_uf,
    c.notes,
    c.last_validated_at,
    c.last_validated_by,
    c.is_deleted,
    c.created_at,
    c.updated_at,
    c.primary_crm,
    c.primary_crm_uf,
    c.primary_rqe,
    c.primary_specialty,
    c.primary_facility,
    c.links_count,
    c.has_contact,
    c.total_count
  from counted c
  order by
    case when p_sort = 'name' and p_sort_dir = 'asc' then c.full_name end asc,
    case when p_sort = 'name' and p_sort_dir = 'desc' then c.full_name end desc,
    case when p_sort = 'confidence' and p_sort_dir = 'asc' then c.confidence_score end asc,
    case when p_sort = 'confidence' and p_sort_dir = 'desc' then c.confidence_score end desc,
    case when p_sort = 'created_at' and p_sort_dir = 'asc' then c.created_at end asc,
    case when p_sort = 'created_at' and p_sort_dir = 'desc' then c.created_at end desc,
    case when p_sort = 'last_validated_at' and p_sort_dir = 'asc' then c.last_validated_at end asc nulls last,
    case when p_sort = 'last_validated_at' and p_sort_dir = 'desc' then c.last_validated_at end desc nulls last,
    case when p_sort = 'links' and p_sort_dir = 'asc' then c.links_count end asc,
    case when p_sort = 'links' and p_sort_dir = 'desc' then c.links_count end desc,
    case when coalesce(p_sort, 'updated_at') = 'updated_at' and p_sort_dir = 'asc' then c.updated_at end asc,
    case when coalesce(p_sort, 'updated_at') <> 'name'
      and coalesce(p_sort, 'updated_at') <> 'confidence'
      and coalesce(p_sort, 'updated_at') <> 'created_at'
      and coalesce(p_sort, 'updated_at') <> 'last_validated_at'
      and coalesce(p_sort, 'updated_at') <> 'links'
      then c.updated_at end desc
  limit v_limit
  offset v_offset;
end;
$$;

grant execute on function public.search_doctors to authenticated;

-- ---------------------------------------------------------------------------
-- Pontuação de confiança explicável (não promove classificação)
-- ---------------------------------------------------------------------------

create or replace function public.explain_doctor_confidence(p_doctor_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_doctor public.doctors%rowtype;
  v_crm integer := 0;
  v_rqe integer := 0;
  v_links integer := 0;
  v_evidence integer := 0;
  v_contact integer := 0;
  v_penalty integer := 0;
  v_score integer := 0;
begin
  select * into v_doctor from public.doctors where id = p_doctor_id;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if exists (
    select 1 from public.medical_registrations
    where doctor_id = p_doctor_id and registration_type = 'CRM' and status = 'ativo'
  ) then
    v_crm := 25;
  elsif exists (
    select 1 from public.medical_registrations
    where doctor_id = p_doctor_id and registration_type = 'CRM'
  ) then
    v_crm := 15;
  end if;

  if exists (
    select 1 from public.medical_registrations
    where doctor_id = p_doctor_id and registration_type = 'RQE' and confidence_score >= 70
  ) then
    v_rqe := 20;
  elsif exists (
    select 1 from public.medical_registrations
    where doctor_id = p_doctor_id and registration_type = 'RQE'
  ) then
    v_rqe := 10;
  end if;

  select least(20, count(*)::integer * 8) into v_links
  from public.doctor_facility_links
  where doctor_id = p_doctor_id and is_deleted = false and status in ('ativo', 'provisorio');

  select least(20, count(*)::integer * 10) into v_evidence
  from public.evidences
  where entity_type = 'doctor' and entity_id = p_doctor_id and status = 'aceita';

  if exists (
    select 1 from public.professional_contacts
    where doctor_id = p_doctor_id and is_deleted = false and do_not_contact = false
  ) then
    v_contact := 10;
  end if;

  if v_doctor.validation_status = 'rejeitada' then
    v_penalty := v_penalty + 30;
  end if;
  if not exists (
    select 1 from public.medical_registrations
    where doctor_id = p_doctor_id and registration_type = 'CRM'
  ) then
    v_penalty := v_penalty + 15;
  end if;

  v_score := greatest(0, least(100, v_crm + v_rqe + v_links + v_evidence + v_contact - v_penalty));

  return jsonb_build_object(
    'score', v_score,
    'band', case
      when v_score < 40 then 'baixa'
      when v_score < 60 then 'precisa_validacao'
      when v_score < 80 then 'moderada'
      else 'alta'
    end,
    'components', jsonb_build_object(
      'crm', v_crm,
      'rqe', v_rqe,
      'links', v_links,
      'evidences', v_evidence,
      'contacts', v_contact,
      'penalties', v_penalty
    ),
    'calculated_at', now(),
    'human_decision_required', true,
    'note', 'A pontuação apoia a análise; a decisão final é humana.'
  );
end;
$$;

grant execute on function public.explain_doctor_confidence to authenticated;

comment on function public.search_doctors is
  'Busca unificada de médicos. Contatos restritos (do_not_contact) não contam como disponíveis.';
comment on function public.explain_doctor_confidence is
  'Explica a pontuação de confiança sem alterar classification automaticamente.';
