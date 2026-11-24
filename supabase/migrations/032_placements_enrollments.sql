-- Migration 032: Student placements, course enrolments and access-context helpers (E3).
--
-- A placement is a student's level for an academic session. Students may only CLAIM a
-- level; it grants level-scoped access once an administrator (later: the level's course
-- representative) CONFIRMS it. Confirming also updates the cached profiles.level through
-- the placement workflow flag accepted by the identity guard (migration 023).
-- Enrolments link students to course offerings (core, carry-over, elective, audit).

create table if not exists public.student_placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  level_code text not null references public.academic_levels(code),
  department_id uuid references public.departments(id),
  status text not null default 'claimed' check (status in ('claimed', 'confirmed', 'rejected')),
  source text not null default 'student_request' check (source in ('student_request', 'admin', 'legacy_backfill')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  note text check (note is null or length(trim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_placements_one_per_session unique (student_id, session_id)
);
create index if not exists student_placements_level_idx on public.student_placements (session_id, level_code, status);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete restrict,
  enrolment_type text not null check (enrolment_type in ('core', 'carryover', 'elective', 'audit')),
  status text not null default 'active' check (status in ('active', 'dropped', 'completed')),
  source text not null default 'admin' check (source in ('admin', 'auto_level', 'legacy_backfill')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_enrollments_unique unique (student_id, offering_id)
);
create index if not exists course_enrollments_student_idx on public.course_enrollments (student_id, status);
create index if not exists course_enrollments_offering_idx on public.course_enrollments (offering_id, status);

drop trigger if exists set_student_placements_updated_at on public.student_placements;
create trigger set_student_placements_updated_at before update on public.student_placements
for each row execute function public.update_updated_at_column();
drop trigger if exists set_course_enrollments_updated_at on public.course_enrollments;
create trigger set_course_enrollments_updated_at before update on public.course_enrollments
for each row execute function public.update_updated_at_column();

-- RLS: students read their own rows; admins read all; all writes go through RPCs.
alter table public.student_placements enable row level security;
alter table public.course_enrollments enable row level security;
revoke all on public.student_placements, public.course_enrollments from public, anon, authenticated;
grant select on public.student_placements, public.course_enrollments to authenticated;
grant all on public.student_placements, public.course_enrollments to service_role;

drop policy if exists "student_placements_select" on public.student_placements;
create policy "student_placements_select" on public.student_placements for select to authenticated
  using (student_id = auth.uid() or public.is_admin());
drop policy if exists "course_enrollments_select" on public.course_enrollments;
create policy "course_enrollments_select" on public.course_enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

-- Student: claim a level for the current session (re-claim allowed until confirmed).
create or replace function public.request_placement(p_level_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := public.current_session_id();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authenticated session required.'; end if;
  if v_session is null then raise exception 'No academic session is open yet.'; end if;
  if not exists (select 1 from public.academic_levels where code = p_level_code) then
    raise exception 'Choose a valid level.';
  end if;

  if exists (
    select 1 from public.student_placements
    where student_id = v_uid and session_id = v_session and status = 'confirmed'
  ) then
    raise exception 'Your level for this session is already confirmed. Contact your course representative to change it.';
  end if;

  insert into public.student_placements (student_id, session_id, level_code, department_id, status, source)
  values (v_uid, v_session, p_level_code, (select department_id from public.profiles where id = v_uid), 'claimed', 'student_request')
  on conflict (student_id, session_id) do update
    set level_code = excluded.level_code, status = 'claimed', confirmed_by = null, confirmed_at = null
  returning id into v_id;

  return v_id;
end;
$$;

-- Admin: confirm or reject claimed placements (never one's own).
create or replace function public.confirm_placements(p_placement_ids uuid[], p_status text, p_note text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_count integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_status not in ('confirmed', 'rejected') then raise exception 'Choose confirm or reject.'; end if;

  for v_row in
    select * from public.student_placements where id = any(p_placement_ids) for update
  loop
    if v_row.student_id = v_uid then
      raise exception 'You cannot confirm your own placement.';
    end if;

    update public.student_placements
    set status = p_status,
        confirmed_by = v_uid,
        confirmed_at = now(),
        note = nullif(trim(coalesce(p_note, '')), '')
    where id = v_row.id;

    if p_status = 'confirmed' and v_row.session_id = public.current_session_id() then
      perform set_config('blueprint.placement_rpc', 'on', true);
      update public.profiles set level = v_row.level_code where id = v_row.student_id;
      perform set_config('blueprint.placement_rpc', 'off', true);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Admin: enrol every confirmed student of a level into that level's offerings for a semester.
create or replace function public.enroll_level_core(p_semester_id uuid, p_level_code text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;

  insert into public.course_enrollments (student_id, offering_id, enrolment_type, source, created_by)
  select p.student_id, o.id, 'core', 'auto_level', auth.uid()
  from public.course_offerings o
  join public.semesters s on s.id = o.semester_id
  join public.student_placements p
    on p.session_id = s.session_id and p.level_code = o.level_code and p.status = 'confirmed'
  where o.semester_id = p_semester_id
    and o.level_code = p_level_code
    and o.status <> 'cancelled'
  on conflict (student_id, offering_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Admin: enrol one student (carry-over, elective, audit) or change an enrolment's status.
create or replace function public.enroll_student(p_student_id uuid, p_offering_id uuid, p_type text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  insert into public.course_enrollments (student_id, offering_id, enrolment_type, source, created_by)
  values (p_student_id, p_offering_id, p_type, 'admin', auth.uid())
  on conflict (student_id, offering_id) do update set enrolment_type = excluded.enrolment_type, status = 'active'
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_enrollment_status(p_enrollment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_status not in ('active', 'dropped', 'completed') then raise exception 'Invalid enrolment status.'; end if;
  update public.course_enrollments set status = p_status where id = p_enrollment_id;
  if not found then raise exception 'Enrolment not found.'; end if;
end;
$$;

-- Access-context helpers for RLS and the app.
create or replace function public.my_confirmed_level(p_session_id uuid default null)
returns text
language sql stable security definer set search_path = pg_catalog, public as $$
  select level_code from public.student_placements
  where student_id = auth.uid()
    and session_id = coalesce(p_session_id, public.current_session_id())
    and status = 'confirmed';
$$;

create or replace function public.my_offering_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select offering_id from public.course_enrollments
  where student_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_access_context()
returns table (
  is_admin boolean,
  verification_status text,
  department_id uuid,
  level_code text,
  session_id uuid,
  placement_status text
)
language sql stable security definer set search_path = pg_catalog, public as $$
  select
    public.is_admin(),
    p.verification_status,
    p.department_id,
    sp.level_code,
    public.current_session_id(),
    sp.status
  from public.profiles p
  left join public.student_placements sp
    on sp.student_id = p.id and sp.session_id = public.current_session_id()
  where p.id = auth.uid();
$$;

revoke all on function
  public.request_placement(text),
  public.confirm_placements(uuid[], text, text),
  public.enroll_level_core(uuid, text),
  public.enroll_student(uuid, uuid, text),
  public.set_enrollment_status(uuid, text),
  public.my_confirmed_level(uuid),
  public.my_offering_ids(),
  public.my_access_context()
from public, anon;
grant execute on function
  public.request_placement(text),
  public.confirm_placements(uuid[], text, text),
  public.enroll_level_core(uuid, text),
  public.enroll_student(uuid, uuid, text),
  public.set_enrollment_status(uuid, text),
  public.my_confirmed_level(uuid),
  public.my_offering_ids(),
  public.my_access_context()
to authenticated, service_role;
