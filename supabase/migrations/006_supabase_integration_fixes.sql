-- 006: correções de integração Supabase (segurança, extensões, diagnóstico)
-- Idempotente onde possível. Não promove papéis automaticamente.

-- ---------------------------------------------------------------------------
-- Extensões: garantir schema e disponibilidade
-- ---------------------------------------------------------------------------

create schema if not exists extensions;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Normalização com search_path explícito + grant
create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select trim(both from regexp_replace(
    lower(extensions.unaccent(coalesce(input, ''))),
    '\s+',
    ' ',
    'g'
  ));
$$;

grant execute on function public.normalize_search_text(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria: impedir forja de actor_id em insert direto
-- ---------------------------------------------------------------------------

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs for insert
  with check (
    public.is_authenticated_user()
    and actor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Perfis: self-insert só como visualizador; Master controla papéis
-- ---------------------------------------------------------------------------

drop policy if exists "users_profile_insert_self_or_master" on public.users_profile;
create policy "users_profile_insert_self_or_master" on public.users_profile for insert
  with check (
    (
      id = auth.uid()
      and role = 'visualizador'::public.app_role
      and is_active = true
    )
    or public.is_master()
  );

-- ---------------------------------------------------------------------------
-- RPC de diagnóstico (somente Master via is_master)
-- ---------------------------------------------------------------------------

create or replace function public.diagnostic_foundation_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
  v_is_master boolean;
begin
  v_is_master := public.is_master();
  if not v_is_master then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'Diagnóstico restrito a Master'
    );
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'tables', jsonb_build_object(
      'users_profile', to_regclass('public.users_profile') is not null,
      'doctors', to_regclass('public.doctors') is not null,
      'health_facilities', to_regclass('public.health_facilities') is not null,
      'doctor_facility_links', to_regclass('public.doctor_facility_links') is not null,
      'professional_contacts', to_regclass('public.professional_contacts') is not null,
      'evidences', to_regclass('public.evidences') is not null,
      'review_queue', to_regclass('public.review_queue') is not null,
      'audit_logs', to_regclass('public.audit_logs') is not null
    ),
    'functions', jsonb_build_object(
      'search_doctors', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'search_doctors'
      ),
      'explain_doctor_confidence', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'explain_doctor_confidence'
      ),
      'write_audit_log', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'write_audit_log'
      ),
      'normalize_search_text', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'normalize_search_text'
      )
    ),
    'extensions', jsonb_build_object(
      'unaccent', exists (select 1 from pg_extension where extname = 'unaccent'),
      'pg_trgm', exists (select 1 from pg_extension where extname = 'pg_trgm')
    ),
    'smoke', jsonb_build_object(
      'unaccent_sample', extensions.unaccent('Hemodinâmica'),
      'normalize_sample', public.normalize_search_text('José da Silva')
    )
  );

  return v_result;
end;
$$;

revoke all on function public.diagnostic_foundation_check() from public;
grant execute on function public.diagnostic_foundation_check() to authenticated;

comment on function public.diagnostic_foundation_check is
  'Checagem de fundação para Master. Não retorna segredos.';
