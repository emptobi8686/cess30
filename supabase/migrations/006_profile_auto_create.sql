-- Migration 006: Automatically create a profile row when a new auth user is created.
--
-- When a student registers via Supabase Auth, their user metadata contains full_name
-- and matric_number supplied during sign-up. This trigger copies those values into
-- public.profiles so the application can display profile data without requiring a
-- separate client-side insert.
--
-- The trigger is set search_path to prevent schema-injection attacks.
-- A conflict on the profiles primary key is silently ignored so that manual or
-- duplicate trigger invocations remain idempotent.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_full_name   text;
  v_matric      text;
  v_department  text;
  v_level       text;
begin
  -- Read metadata supplied at sign-up time.
  v_full_name  := coalesce(new.raw_user_meta_data->>'full_name',  '');
  v_matric     := coalesce(new.raw_user_meta_data->>'matric_number', '');
  v_department := coalesce(new.raw_user_meta_data->>'department', 'Civil Engineering');
  v_level      := coalesce(new.raw_user_meta_data->>'level',      '200');

  -- Only proceed when the minimum required fields are present.
  if v_full_name = '' or v_matric = '' then
    return new;
  end if;

  insert into public.profiles (id, full_name, matric_number, department, level)
  values (new.id, v_full_name, v_matric, v_department, v_level)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Remove the trigger if it already exists so this migration is re-runnable.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Grant execute only to postgres (the trigger runs as the trigger owner, not as the
-- calling user, because the function is SECURITY DEFINER).
revoke all on function public.handle_new_user() from public, authenticated, anon;
grant execute on function public.handle_new_user() to postgres;
