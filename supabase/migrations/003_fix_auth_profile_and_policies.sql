-- Correções de autorização, exclusão lógica e alinhamento de permissões
-- Não promove ninguém a Master automaticamente.

-- ---------------------------------------------------------------------------
-- Impede escalonamento de papel / reativação por não-master
-- ---------------------------------------------------------------------------

create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_master() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Somente Master pode alterar papéis';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Somente Master pode ativar ou desativar usuários';
  end if;

  if new.email is distinct from old.email then
    raise exception 'E-mail do perfil não pode ser alterado por este usuário';
  end if;

  return new;
end;
$$;

drop trigger if exists users_profile_prevent_escalation on public.users_profile;
create trigger users_profile_prevent_escalation
before update on public.users_profile
for each row execute function public.prevent_privilege_escalation();

-- ---------------------------------------------------------------------------
-- Policies: sem exclusão física nas entidades principais
-- ---------------------------------------------------------------------------

drop policy if exists "doctors_delete_master" on public.doctors;
drop policy if exists "health_facilities_delete_master" on public.health_facilities;

-- Visualizador vê apenas camada oficial; analista/master veem candidatos/brutos
drop policy if exists "doctors_select" on public.doctors;
create policy "doctors_select" on public.doctors for select
  using (
    public.is_authenticated_user()
    and is_deleted = false
    and (public.can_write() or layer = 'oficial')
  );

drop policy if exists "health_facilities_select" on public.health_facilities;
create policy "health_facilities_select" on public.health_facilities for select
  using (
    public.is_authenticated_user()
    and is_deleted = false
    and (public.can_write() or layer = 'oficial')
  );

-- Dados brutos: apenas quem escreve (Master/Analista)
drop policy if exists "import_batches_select" on public.import_batches;
create policy "import_batches_select" on public.import_batches for select
  using (public.can_write());

drop policy if exists "raw_records_select" on public.raw_records;
create policy "raw_records_select" on public.raw_records for select
  using (public.can_write());

-- Fila de validação: visualizador não precisa ver pendências operacionais
drop policy if exists "review_queue_select" on public.review_queue;
create policy "review_queue_select" on public.review_queue for select
  using (public.can_write());

-- Auditoria: Master completa; Analista apenas próprios eventos
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select
  using (
    public.is_master()
    or (public.can_write() and actor_id = auth.uid())
  );

-- Atualização de perfil: self (campos não privilegiados) ou Master
drop policy if exists "users_profile_update_self_or_master" on public.users_profile;
create policy "users_profile_update_self" on public.users_profile for update
  using (id = auth.uid() and public.is_authenticated_user())
  with check (id = auth.uid());

create policy "users_profile_update_master" on public.users_profile for update
  using (public.is_master())
  with check (public.is_master());

-- Insert de perfil: trigger (security definer) ou Master; self-insert só no próprio id
drop policy if exists "users_profile_insert_master" on public.users_profile;
create policy "users_profile_insert_self_or_master" on public.users_profile for insert
  with check (id = auth.uid() or public.is_master());

-- Confirma helpers com is_active (idempotente)
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

-- Garante handle_new_user com papel visualizador (viewer) e sem promoção
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'visualizador',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
