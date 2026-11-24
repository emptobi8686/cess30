-- Migration 030: Academic structure (department-wide expansion, E1).
--
-- Levels, sessions and semesters are data (rows), so calendar changes never need a
-- migration. Administrators (and later course representatives, see migration for
-- staff capabilities) maintain them in the app. Existing 200-level data is preserved:
-- only nullable department_id columns are added to profiles and courses.

-- 1. Departments ------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Department code is provisional until decision 0003 item 1 confirms it.
insert into public.departments (code, name) values ('CVE', 'Civil Engineering')
on conflict (name) do nothing;

-- 2. Levels -------------------------------------------------------------------------
create table if not exists public.academic_levels (
  code text primary key check (code ~ '^[1-9]00$'),
  ordinal smallint not null unique,
  label text not null
);

insert into public.academic_levels (code, ordinal, label) values
  ('100', 1, '100 Level'), ('200', 2, '200 Level'), ('300', 3, '300 Level'),
  ('400', 4, '400 Level'), ('500', 5, '500 Level')
on conflict (code) do nothing;

-- 3. Sessions and semesters ---------------------------------------------------------
create table if not exists public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (label ~ '^\d{4}/\d{4}$'),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_sessions_dates check (starts_on < ends_on)
);
create unique index if not exists academic_sessions_one_current
  on public.academic_sessions (is_current) where is_current;

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  number smallint not null check (number in (1, 2, 3)),
  label text not null check (length(trim(label)) between 3 and 40),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint semesters_dates check (starts_on < ends_on),
  constraint semesters_unique_number unique (session_id, number)
);
create unique index if not exists semesters_one_current
  on public.semesters (is_current) where is_current;
create index if not exists semesters_dates_idx on public.semesters (starts_on, ends_on);

create or replace function public.semester_within_session()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_start date;
  v_end date;
begin
  select starts_on, ends_on into v_start, v_end
  from public.academic_sessions where id = new.session_id;
  if new.starts_on < v_start or new.ends_on > v_end then
    raise exception 'Semester dates must fall within the academic session (% to %).', v_start, v_end
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists semesters_within_session on public.semesters;
create trigger semesters_within_session
before insert or update on public.semesters
for each row execute function public.semester_within_session();

-- 4. Current session / semester -----------------------------------------------------
-- Two statements: unique indexes are checked row by row, so flipping both flags in one
-- UPDATE can transiently violate the partial unique index.
create or replace function public.set_current_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if not exists (select 1 from public.academic_sessions where id = p_session_id) then
    raise exception 'Academic session not found.';
  end if;
  update public.semesters set is_current = false
  where is_current and session_id <> p_session_id;
  update public.academic_sessions set is_current = false where is_current and id <> p_session_id;
  update public.academic_sessions set is_current = true where id = p_session_id;
end;
$$;

create or replace function public.set_current_semester(p_semester_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if not exists (
    select 1 from public.semesters s
    join public.academic_sessions a on a.id = s.session_id
    where s.id = p_semester_id and a.is_current
  ) then
    raise exception 'The semester must belong to the current academic session.';
  end if;
  update public.semesters set is_current = false where is_current and id <> p_semester_id;
  update public.semesters set is_current = true where id = p_semester_id;
end;
$$;

-- 5. Read helpers -------------------------------------------------------------------
create or replace function public.current_session_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select id from public.academic_sessions where is_current limit 1;
$$;

create or replace function public.current_semester_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select id from public.semesters where is_current limit 1;
$$;

-- The semester containing a date; null when none (or, defensively, several) match.
create or replace function public.semester_for_date(p_date date)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select case when count(*) = 1 then min(id::text)::uuid end
  from public.semesters
  where p_date between starts_on and ends_on;
$$;

revoke all on function public.set_current_session(uuid), public.set_current_semester(uuid),
  public.current_session_id(), public.current_semester_id(), public.semester_for_date(date)
  from public, anon;
grant execute on function public.set_current_session(uuid), public.set_current_semester(uuid),
  public.current_session_id(), public.current_semester_id(), public.semester_for_date(date)
  to authenticated, service_role;

-- 6. Row level security -------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.academic_levels enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.semesters enable row level security;

revoke all on public.departments, public.academic_levels, public.academic_sessions, public.semesters
  from public, anon, authenticated;
grant select on public.departments, public.academic_levels to authenticated;
grant select, insert, update, delete on public.academic_sessions, public.semesters to authenticated;
grant all on public.departments, public.academic_levels, public.academic_sessions, public.semesters to service_role;

create policy "departments_select" on public.departments for select to authenticated using (true);
create policy "academic_levels_select" on public.academic_levels for select to authenticated using (true);

create policy "academic_sessions_select" on public.academic_sessions for select to authenticated using (true);
create policy "academic_sessions_admin_insert" on public.academic_sessions for insert to authenticated with check (public.is_admin());
create policy "academic_sessions_admin_update" on public.academic_sessions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "academic_sessions_admin_delete" on public.academic_sessions for delete to authenticated using (public.is_admin());

create policy "semesters_select" on public.semesters for select to authenticated using (true);
create policy "semesters_admin_insert" on public.semesters for insert to authenticated with check (public.is_admin());
create policy "semesters_admin_update" on public.semesters for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "semesters_admin_delete" on public.semesters for delete to authenticated using (public.is_admin());

-- 7. Link existing data to the department (additive, non-destructive) ---------------
alter table public.courses add column if not exists department_id uuid references public.departments(id);
alter table public.profiles add column if not exists department_id uuid references public.departments(id);

update public.courses c set department_id = d.id
from public.departments d
where c.department_id is null and d.name = c.department;

update public.profiles p set department_id = d.id
from public.departments d
where p.department_id is null and d.name = p.department;

-- New profiles get the department link too (department text stays the default).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_matric text := nullif(trim(coalesce(new.raw_user_meta_data->>'matric_number', '')), '');
  v_department_id uuid := (select id from public.departments where name = 'Civil Engineering');
begin
  begin
    insert into public.profiles (id, full_name, matric_number, department, department_id, level, avatar_url, verification_status)
    values (new.id, v_full_name, v_matric, 'Civil Engineering', v_department_id, '200', null, 'pending')
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name, matric_number, department, department_id, level, avatar_url, verification_status)
    values (new.id, v_full_name, null, 'Civil Engineering', v_department_id, '200', null, 'pending')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Rows inserted later (e.g. the course seed, which runs after migrations, or courses
-- added in the app) get department_id from the department name automatically.
create or replace function public.set_department_id_from_name()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.department_id is null and new.department is not null then
    select id into new.department_id from public.departments where name = new.department;
  end if;
  return new;
end;
$$;

revoke all on function public.set_department_id_from_name() from public, anon, authenticated;

drop trigger if exists courses_set_department_id on public.courses;
create trigger courses_set_department_id
before insert or update of department on public.courses
for each row execute function public.set_department_id_from_name();
