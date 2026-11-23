-- Migration 035: Content audiences (E4 part 1).
--
-- Who sees an announcement or quest is a set of audience rows (deny by default: no rows,
-- no student sees it). Lectures belong to a course offering. audience_matches() evaluates
-- one audience row for the caller from confirmed placements and active enrolments.
-- Read policies switch to these helpers in a later migration (audience RLS); this one only
-- adds structure, helpers and the replace_audiences RPC (the only way to write audiences).

-- New academic columns -------------------------------------------------------------------
alter table public.lecture_sessions add column if not exists offering_id uuid references public.course_offerings(id) on delete restrict;
alter table public.lecture_sessions add column if not exists series_id uuid;
alter table public.quests add column if not exists offering_id uuid references public.course_offerings(id) on delete set null;
alter table public.quests add column if not exists semester_id uuid references public.semesters(id) on delete set null;
alter table public.study_sessions add column if not exists semester_id uuid references public.semesters(id) on delete set null;
alter table public.announcements add column if not exists session_id uuid references public.academic_sessions(id) on delete set null;
create index if not exists lecture_sessions_offering_idx on public.lecture_sessions (offering_id, lecture_date);
create index if not exists lecture_sessions_series_idx on public.lecture_sessions (series_id) where series_id is not null;

grant insert (offering_id, series_id), update (offering_id, series_id) on public.lecture_sessions to authenticated;

-- A lecture's course always follows its offering.
create or replace function public.lecture_sessions_course_from_offering()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.offering_id is not null then
    select course_id into new.course_id from public.course_offerings where id = new.offering_id;
  end if;
  return new;
end;
$$;
drop trigger if exists lecture_sessions_course_from_offering on public.lecture_sessions;
create trigger lecture_sessions_course_from_offering
before insert or update of offering_id, course_id on public.lecture_sessions
for each row execute function public.lecture_sessions_course_from_offering();

-- Audience tables -------------------------------------------------------------------------
create table if not exists public.announcement_audiences (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  audience_kind text not null check (audience_kind in ('department', 'level', 'course', 'offering', 'staff_only')),
  department_id uuid references public.departments(id) on delete cascade,
  level_code text references public.academic_levels(code),
  course_id uuid references public.courses(id) on delete cascade,
  offering_id uuid references public.course_offerings(id) on delete cascade,
  session_id uuid references public.academic_sessions(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint announcement_audiences_targets check (
    (audience_kind = 'department' and level_code is null and course_id is null and offering_id is null)
    or (audience_kind = 'level' and level_code is not null and course_id is null and offering_id is null)
    or (audience_kind = 'course' and course_id is not null and level_code is null and offering_id is null)
    or (audience_kind = 'offering' and offering_id is not null and level_code is null and course_id is null)
    or (audience_kind = 'staff_only' and department_id is null and level_code is null and course_id is null and offering_id is null)
  )
);
create index if not exists announcement_audiences_owner_idx on public.announcement_audiences (announcement_id);

create table if not exists public.quest_audiences (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  audience_kind text not null check (audience_kind in ('department', 'level', 'course', 'offering', 'staff_only')),
  department_id uuid references public.departments(id) on delete cascade,
  level_code text references public.academic_levels(code),
  course_id uuid references public.courses(id) on delete cascade,
  offering_id uuid references public.course_offerings(id) on delete cascade,
  session_id uuid references public.academic_sessions(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quest_audiences_targets check (
    (audience_kind = 'department' and level_code is null and course_id is null and offering_id is null)
    or (audience_kind = 'level' and level_code is not null and course_id is null and offering_id is null)
    or (audience_kind = 'course' and course_id is not null and level_code is null and offering_id is null)
    or (audience_kind = 'offering' and offering_id is not null and level_code is null and course_id is null)
    or (audience_kind = 'staff_only' and department_id is null and level_code is null and course_id is null and offering_id is null)
  )
);
create index if not exists quest_audiences_owner_idx on public.quest_audiences (quest_id);

alter table public.announcement_audiences enable row level security;
alter table public.quest_audiences enable row level security;
revoke all on public.announcement_audiences, public.quest_audiences from anon, authenticated;
grant select on public.announcement_audiences, public.quest_audiences to authenticated;
grant all on public.announcement_audiences, public.quest_audiences to service_role;

-- Matching -----------------------------------------------------------------------------------
create or replace function public.audience_matches(
  p_kind text, p_department_id uuid, p_level_code text, p_course_id uuid,
  p_offering_id uuid, p_session_id uuid, p_semester_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case p_kind
    when 'department' then exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p_department_id is null or p.department_id = p_department_id))
    when 'level' then exists (
      select 1 from public.student_placements sp
      where sp.student_id = auth.uid() and sp.status = 'confirmed' and sp.level_code = p_level_code
        and sp.session_id = coalesce(p_session_id, public.current_session_id()))
    when 'offering' then exists (
      select 1 from public.course_enrollments e
      where e.student_id = auth.uid() and e.status = 'active' and e.offering_id = p_offering_id)
    when 'course' then exists (
      select 1 from public.course_enrollments e
      join public.course_offerings o on o.id = e.offering_id
      where e.student_id = auth.uid() and e.status = 'active' and o.course_id = p_course_id
        and (p_semester_id is null or o.semester_id = p_semester_id))
    else false
  end;
$$;

create or replace function public.my_verification_status()
returns text
language sql stable security definer set search_path = pg_catalog, public
as $$ select verification_status from public.profiles where id = auth.uid(); $$;

-- Decision 0004 item 1 (audit default): pending and rejected students read department-wide
-- announcements and the timetable of their claimed level; suspended students read nothing.
create or replace function public.can_view_announcement(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  if public.is_admin() then return true; end if;
  v_status := public.my_verification_status();
  if v_status = 'verified' then
    return exists (
      select 1 from public.announcement_audiences a
      where a.announcement_id = p_id
        and public.audience_matches(a.audience_kind, a.department_id, a.level_code, a.course_id, a.offering_id, a.session_id, a.semester_id));
  elsif v_status in ('pending', 'rejected') then
    return exists (
      select 1 from public.announcement_audiences a
      where a.announcement_id = p_id and a.audience_kind = 'department'
        and public.audience_matches(a.audience_kind, a.department_id, a.level_code, a.course_id, a.offering_id, a.session_id, a.semester_id));
  end if;
  return false;
end;
$$;

create or replace function public.can_view_quest(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.is_admin() then return true; end if;
  if public.my_verification_status() is distinct from 'verified' then return false; end if;
  return exists (
    select 1 from public.quest_audiences a
    where a.quest_id = p_id
      and public.audience_matches(a.audience_kind, a.department_id, a.level_code, a.course_id, a.offering_id, a.session_id, a.semester_id));
end;
$$;

-- Lectures: enrolled offerings. Before enrolments are run, a confirmed (or, for pending and
-- rejected students, claimed) level sees its level's offerings; legacy lectures without an
-- offering follow the course's level.
create or replace function public.can_view_lecture(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_offering uuid;
  v_offering_level text;
  v_course_level text;
  v_level text;
begin
  if public.is_admin() then return true; end if;
  v_status := public.my_verification_status();
  if v_status is null or v_status = 'suspended' then return false; end if;

  select l.offering_id, o.level_code, c.level
    into v_offering, v_offering_level, v_course_level
  from public.lecture_sessions l
  join public.courses c on c.id = l.course_id
  left join public.course_offerings o on o.id = l.offering_id
  where l.id = p_id;
  if not found then return false; end if;

  if v_status = 'verified' then
    if v_offering is not null and v_offering in (select public.my_offering_ids()) then return true; end if;
    v_level := public.my_confirmed_level();
    if v_level is null then return false; end if;
    if v_offering is null then return v_course_level = v_level; end if;
    return v_offering_level = v_level
       and not exists (select 1 from public.course_enrollments where student_id = auth.uid() and status = 'active');
  end if;

  select level_code into v_level from public.student_placements
  where student_id = auth.uid() and session_id = public.current_session_id() and status in ('claimed', 'confirmed');
  if v_level is null then return false; end if;
  return coalesce(v_offering_level, v_course_level) = v_level;
end;
$$;

-- Managing (staff) ---------------------------------------------------------------------------
create or replace function public.audience_row_allowed(p_kind text, p_level_code text, p_course_id uuid, p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case p_kind
    when 'department' then public.has_capability('department_admin')
    when 'staff_only' then public.has_capability('department_admin')
    when 'level' then public.has_capability('level_coordinator', p_level_code)
    when 'course' then public.has_capability('level_coordinator', null, p_course_id)
    when 'offering' then public.has_capability('level_coordinator', null, null, p_offering_id)
    else false
  end;
$$;

-- An item is manageable by an administrator; by a course rep when every one of its
-- audiences is within their scope; or, while it has no audience yet, by its author.
create or replace function public.can_manage_announcement(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or (
    public.holds_capability('level_coordinator')
    and exists (select 1 from public.announcements where id = p_id)
    and not exists (
      select 1 from public.announcement_audiences a
      where a.announcement_id = p_id
        and not public.audience_row_allowed(a.audience_kind, a.level_code, a.course_id, a.offering_id))
    and (
      exists (select 1 from public.announcement_audiences where announcement_id = p_id)
      or exists (select 1 from public.announcements where id = p_id and created_by = auth.uid())
    )
  );
$$;

create or replace function public.can_manage_quest(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or (
    public.holds_capability('level_coordinator')
    and exists (select 1 from public.quests where id = p_id)
    and not exists (
      select 1 from public.quest_audiences a
      where a.quest_id = p_id
        and not public.audience_row_allowed(a.audience_kind, a.level_code, a.course_id, a.offering_id))
    and (
      exists (select 1 from public.quest_audiences where quest_id = p_id)
      or exists (select 1 from public.quests where id = p_id and created_by = auth.uid())
    )
  );
$$;

create or replace function public.replace_audiences(p_table text, p_owner uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb;
  v_kind text;
  v_count integer := 0;
  v_dept uuid;
begin
  if p_table not in ('announcement_audiences', 'quest_audiences') then raise exception 'Unknown audience table.'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 20 then
    raise exception 'Give at most 20 audiences.';
  end if;
  if (p_table = 'announcement_audiences' and not public.can_manage_announcement(p_owner))
     or (p_table = 'quest_audiences' and not public.can_manage_quest(p_owner)) then
    raise exception 'You cannot change who sees this.';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_kind := v_row->>'audience_kind';
    if not public.audience_row_allowed(v_kind, v_row->>'level_code', (v_row->>'course_id')::uuid, (v_row->>'offering_id')::uuid) then
      raise exception 'You cannot target that audience.';
    end if;
  end loop;

  select id into v_dept from public.departments where code = 'CVE';

  if p_table = 'announcement_audiences' then
    delete from public.announcement_audiences where announcement_id = p_owner;
    insert into public.announcement_audiences (announcement_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind',
           case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid,
           (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  else
    delete from public.quest_audiences where quest_id = p_owner;
    insert into public.quest_audiences (quest_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind',
           case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid,
           (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Audience rows are readable with their parent (or by whoever manages it).
drop policy if exists "announcement_audiences_select" on public.announcement_audiences;
create policy "announcement_audiences_select" on public.announcement_audiences for select to authenticated
  using (public.can_manage_announcement(announcement_id) or public.can_view_announcement(announcement_id));
drop policy if exists "quest_audiences_select" on public.quest_audiences;
create policy "quest_audiences_select" on public.quest_audiences for select to authenticated
  using (public.can_manage_quest(quest_id) or public.can_view_quest(quest_id));

revoke all on function
  public.audience_matches(text, uuid, text, uuid, uuid, uuid, uuid),
  public.my_verification_status(),
  public.can_view_announcement(uuid),
  public.can_view_quest(uuid),
  public.can_view_lecture(uuid),
  public.audience_row_allowed(text, text, uuid, uuid),
  public.can_manage_announcement(uuid),
  public.can_manage_quest(uuid),
  public.replace_audiences(text, uuid, jsonb),
  public.lecture_sessions_course_from_offering()
from public, anon;
grant execute on function
  public.audience_matches(text, uuid, text, uuid, uuid, uuid, uuid),
  public.my_verification_status(),
  public.can_view_announcement(uuid),
  public.can_view_quest(uuid),
  public.can_view_lecture(uuid),
  public.audience_row_allowed(text, text, uuid, uuid),
  public.can_manage_announcement(uuid),
  public.can_manage_quest(uuid),
  public.replace_audiences(text, uuid, jsonb)
to authenticated, service_role;
revoke all on function public.lecture_sessions_course_from_offering() from authenticated;
