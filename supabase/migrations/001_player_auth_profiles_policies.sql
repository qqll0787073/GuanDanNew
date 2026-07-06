-- Player registration/profile policies for Supabase Auth.
--
-- This migration supports browser-side player registration:
-- 1. supabase.auth.signUp() creates auth.users.
-- 2. The authenticated user inserts their own public.profiles row.
-- 3. Approved users can later read and update only their own profile.

alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert on table public.profiles to authenticated;

-- Keep player self-updates away from role/status/admin approval fields.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar_url, preferred_language)
on table public.profiles
to authenticated;

drop policy if exists "players can select own profile" on public.profiles;
create policy "players can select own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "players can insert own player profile" on public.profiles;
create policy "players can insert own player profile"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and role = 'player'
  and email = auth.jwt() ->> 'email'
  and status = case
    when now() < timestamptz '2026-07-26 00:00:00+00' then 'approved'
    else 'pending'
  end
);

drop policy if exists "players can update own player profile" on public.profiles;
create policy "players can update own player profile"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and role = 'player'
)
with check (
  id = auth.uid()
  and role = 'player'
);
