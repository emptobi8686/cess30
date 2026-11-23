-- Migration 031: Course offerings (department-wide expansion, E2).
--
-- courses stays the reusable catalogue ("GET209 exists, 3 units"); an offering says
-- "GET209 is taught in First Semester 2026/2027 to 200 Level". Lectures, level/course
-- content and enrolments attach to offerings in later migrations. Write access is
-- admin-only here; course representatives receive scoped rights with staff capabilities.

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  level_code text not null references public.academic_levels(code),
  department_id uuid references public.departments(id),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_offerings_unique unique (course_id, semester_id, level_code)
);

create index if not exists course_offerings_semester_level_idx on public.course_offerings (semester_id, level_code);

-- Default the department and author from context.
create or replace function public.course_offerings_defaults()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.department_id is null then
    select department_id into new.department_id from public.courses where id = new.course_id;
  end if;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.course_offerings_defaults() from public, anon, authenticated;

drop trigger if exists course_offerings_set_defaults on public.course_offerings;
create trigger course_offerings_set_defaults
before insert or update on public.course_offerings
for each row execute function public.course_offerings_defaults();

drop trigger if exists set_course_offerings_updated_at on public.course_offerings;
create trigger set_course_offerings_updated_at
before update on public.course_offerings
for each row execute function public.update_updated_at_column();

-- The offering of a course for the semester containing a date, at a level.
create or replace function public.offering_for(p_course_id uuid, p_date date, p_level_code text)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.id
  from public.course_offerings o
  where o.course_id = p_course_id
    and o.level_code = p_level_code
    and o.semester_id = public.semester_for_date(p_date)
    and o.status <> 'cancelled';
$$;

revoke all on function public.offering_for(uuid, date, text) from public, anon;
grant execute on function public.offering_for(uuid, date, text) to authenticated, service_role;

alter table public.course_offerings enable row level security;
revoke all on public.course_offerings from public, anon, authenticated;
grant select, insert, update, delete on public.course_offerings to authenticated;
grant all on public.course_offerings to service_role;

create policy "course_offerings_select" on public.course_offerings
  for select to authenticated using (true);
create policy "course_offerings_admin_insert" on public.course_offerings
  for insert to authenticated with check (public.is_admin());
create policy "course_offerings_admin_update" on public.course_offerings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "course_offerings_admin_delete" on public.course_offerings
  for delete to authenticated using (public.is_admin());
