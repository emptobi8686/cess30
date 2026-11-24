-- Migration 014: Profile enhancements and matriculation verification.
--
-- Changes:
--   1. Add `nickname` column to public.profiles for student display names.
--   2. Re-grant INSERT/UPDATE/DELETE on public.profiles to authenticated.
--      Migration 010 revoked these (leaving only SELECT), which caused
--      "permission denied for table profiles" on any profile write via the
--      server client. RLS policies (and the prevent_profile_identity_changes
--      trigger) remain the authority for what fields students may change.
--   3. Create a public Storage bucket for profile pictures.
--   4. Add RLS policies for profile picture uploads.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. nickname column on profiles
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists nickname text;

comment on column public.profiles.nickname is
  'Optional student nickname/display name. Students may set and change it.';

create index if not exists idx_profiles_nickname
  on public.profiles(nickname);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Re-grant profile write access to authenticated (RLS enforces restrictions)
-- ─────────────────────────────────────────────────────────────────────────

grant insert, update, delete on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket for profile pictures
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  '{"image/jpeg","image/png","image/webp","image/gif"}'::text[]
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Storage RLS policies for profile pictures
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "profile_pictures_select_authenticated" on storage.objects;
create policy "profile_pictures_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-pictures');

drop policy if exists "profile_pictures_insert_authenticated" on storage.objects;
create policy "profile_pictures_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (auth.uid())::text = split_part(name, '/', 1)
);

drop policy if exists "profile_pictures_update_authenticated" on storage.objects;
create policy "profile_pictures_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (auth.uid())::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'profile-pictures'
  and (auth.uid())::text = split_part(name, '/', 1)
);

drop policy if exists "profile_pictures_delete_authenticated" on storage.objects;
create policy "profile_pictures_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (auth.uid())::text = split_part(name, '/', 1)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Profile RLS policies (ensure students can update their own profile)
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  -- Students can read their own profile.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);
  end if;

  -- Students can insert their own profile (used by handle_new_user trigger).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);
  end if;

  -- Students can update their own profile. The trigger
  -- prevent_profile_identity_changes() restricts which fields may change.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Reaffirm the existing trigger protects identity fields
-- ─────────────────────────────────────────────────────────────────────────

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();
