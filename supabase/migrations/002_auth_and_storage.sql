-- Bootstrap de perfil + buckets de storage

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'visualizador'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buckets privados (evidências e importações)
insert into storage.buckets (id, name, public)
values
  ('evidences', 'evidences', false),
  ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "imports_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'imports' and public.is_authenticated_user());

create policy "imports_writers_insert"
  on storage.objects for insert
  with check (bucket_id = 'imports' and public.can_write());

create policy "evidences_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'evidences' and public.is_authenticated_user());

create policy "evidences_writers_insert"
  on storage.objects for insert
  with check (bucket_id = 'evidences' and public.can_write());
