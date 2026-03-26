create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_language text default 'pt-BR',
  origin_city text,
  interests text[] default '{}',
  travel_style text[] default '{}',
  budget_profile text,
  companions_summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    user_id,
    full_name
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();

-- Exemplo rapido para popular um usuario ja existente.
-- Troque SEU_EMAIL_AQUI pelo email real criado no Supabase Auth.
--
-- insert into public.user_profiles (
--   user_id,
--   full_name,
--   preferred_language,
--   origin_city,
--   interests,
--   travel_style,
--   budget_profile,
--   companions_summary,
--   notes
-- )
-- select
--   id,
--   coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), 'Cliente Concierge'),
--   'pt-BR',
--   'Teresina',
--   array['praia', 'gastronomia'],
--   array['casal'],
--   'medio',
--   'Viaja em casal e prioriza conforto com bom custo-beneficio.',
--   'Prefere experiencias no litoral com gastronomia local e deslocamento organizado.'
-- from auth.users
-- where email = 'SEU_EMAIL_AQUI'
-- on conflict (user_id) do update
-- set
--   full_name = excluded.full_name,
--   preferred_language = excluded.preferred_language,
--   origin_city = excluded.origin_city,
--   interests = excluded.interests,
--   travel_style = excluded.travel_style,
--   budget_profile = excluded.budget_profile,
--   companions_summary = excluded.companions_summary,
--   notes = excluded.notes,
--   updated_at = now();
