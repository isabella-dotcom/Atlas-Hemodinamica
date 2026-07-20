-- 010: enriquecimento de vínculos e contatos (aditivo)
-- Expande contact_channel; adiciona status de contato; campos de vínculo.

-- ---------------------------------------------------------------------------
-- Canais de contato novos (enum aditivo)
-- ---------------------------------------------------------------------------

alter type public.contact_channel add value if not exists 'celular';
alter type public.contact_channel add value if not exists 'secretaria';
alter type public.contact_channel add value if not exists 'formulario';
alter type public.contact_channel add value if not exists 'linkedin';

-- ---------------------------------------------------------------------------
-- Status de contato
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'contact_status'
      and n.nspname = 'public'
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
-- doctor_facility_links
-- ---------------------------------------------------------------------------

alter table public.doctor_facility_links
  add column if not exists function_title text,
  add column if not exists practiced_specialty text,
  add column if not exists is_team_leader boolean not null default false,
  add column if not exists is_clinical_staff boolean not null default false,
  add column if not exists weekly_hours numeric(5, 2)
    check (weekly_hours is null or (weekly_hours >= 0 and weekly_hours <= 168)),
  add column if not exists is_sus_link boolean,
  add column if not exists evidence_id uuid references public.evidences (id) on delete set null,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid references public.users_profile (id);

comment on column public.doctor_facility_links.function_title is
  'Função exercida (distinta de role_title/cargo quando aplicável).';
comment on column public.doctor_facility_links.evidence_id is
  'Evidência principal que sustenta o vínculo.';

create index if not exists doctor_facility_links_evidence_idx
  on public.doctor_facility_links (evidence_id)
  where evidence_id is not null;

create index if not exists doctor_facility_links_verified_at_idx
  on public.doctor_facility_links (last_verified_at)
  where last_verified_at is not null;

-- ---------------------------------------------------------------------------
-- professional_contacts
-- ---------------------------------------------------------------------------

alter table public.professional_contacts
  add column if not exists contact_status public.contact_status
    not null default 'nao_validado',
  add column if not exists accepts_contact boolean,
  add column if not exists source_origin text,
  add column if not exists collected_at date,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_attempt_result text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.users_profile (id);

comment on column public.professional_contacts.source_origin is
  'Origem textual da coleta (planilha, site, contato direto, etc.).';
comment on column public.professional_contacts.accepts_contact is
  'Se o titular aceita ser contatado. Distinto de do_not_contact.';

create index if not exists professional_contacts_status_idx
  on public.professional_contacts (contact_status)
  where is_deleted = false;

-- ---------------------------------------------------------------------------
-- RLS contatos: reforço — visualizador só vê públicos e não restritos
-- Preserva nomes das policies da 001/005 ("professional_contacts_*").
-- ---------------------------------------------------------------------------

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

drop policy if exists "professional_contacts_write" on public.professional_contacts;
create policy "professional_contacts_write"
  on public.professional_contacts
  for all
  using (public.can_write())
  with check (public.can_write());
