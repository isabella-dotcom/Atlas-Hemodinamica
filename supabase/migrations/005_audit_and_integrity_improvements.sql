-- 005: auditoria auxiliar e integridade
-- Estratégia de auditoria: camada de serviço (TypeScript) + função SQL opcional.
-- Triggers genéricos em todas as tabelas gerariam ruído; a app registra ações de negócio.

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Auditoria requer usuário autenticado';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.write_audit_log to authenticated;

-- Impede múltiplos CRM principais por médico
create unique index if not exists medical_registrations_one_primary_crm_uq
  on public.medical_registrations (doctor_id)
  where registration_type = 'CRM' and is_primary = true;

-- Impede múltiplas especialidades principais
create unique index if not exists doctor_specialties_one_primary_uq
  on public.doctor_specialties (doctor_id)
  where is_primary = true;

-- Contato principal único por médico
create unique index if not exists professional_contacts_one_primary_doctor_uq
  on public.professional_contacts (doctor_id)
  where doctor_id is not null and is_primary = true and is_deleted = false;

-- Coordenador confirmado exige justificativa ou fonte
create or replace function public.validate_coordinator_fields()
returns trigger
language plpgsql
as $$
begin
  if new.is_coordinator = true
     and new.coordinator_confirmed = true
     and coalesce(nullif(trim(new.coordinator_justification), ''), null) is null
     and new.source_id is null then
    raise exception 'Coordenador confirmado exige justificativa ou fonte';
  end if;

  if new.ended_on is not null and new.started_on is not null
     and new.ended_on < new.started_on then
    raise exception 'Data final não pode ser anterior à data inicial';
  end if;

  return new;
end;
$$;

drop trigger if exists doctor_facility_links_validate_coordinator
  on public.doctor_facility_links;
create trigger doctor_facility_links_validate_coordinator
before insert or update on public.doctor_facility_links
for each row execute function public.validate_coordinator_fields();

-- Atualiza índice único de vínculos ativos considerando soft-delete
drop index if exists doctor_facility_links_active_uq;
create unique index doctor_facility_links_active_uq
  on public.doctor_facility_links (
    doctor_id,
    facility_id,
    coalesce(role_title, ''),
    coalesce(department, '')
  )
  where status <> 'encerrado' and is_deleted = false;

-- Policies: evidências e contatos soft-deleted ocultos na leitura padrão
drop policy if exists "professional_contacts_select" on public.professional_contacts;
create policy "professional_contacts_select" on public.professional_contacts for select
  using (
    public.is_authenticated_user()
    and is_deleted = false
    and (
      public.can_write()
      or (do_not_contact = false and is_publicly_available = true)
    )
  );

drop policy if exists "doctor_facility_links_select" on public.doctor_facility_links;
create policy "doctor_facility_links_select" on public.doctor_facility_links for select
  using (public.is_authenticated_user() and is_deleted = false);

comment on function public.write_audit_log is
  'Registra auditoria de negócio. Preferir esta função ou a camada de serviços; evitar duplicar logs.';
