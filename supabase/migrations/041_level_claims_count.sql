-- Migration 041: A requested level counts for level content (owner report 2026-11-24).
--
-- Students reported receiving no announcements, quests or notifications: content was
-- targeted at "Level 200" but level audiences only matched an admin-CONFIRMED placement,
-- and in practice levels were requested but not yet confirmed. A verified student's
-- requested (claimed) or confirmed level for the current session now matches level
-- audiences, the legacy timetable fallback and lecture reminders. Confirmation is still
-- what enrolment uses (enroll_level_core), and pending/rejected/suspended students are
-- unchanged (verification remains the gate). Rejected placements never match.

create or replace function public.audience_matches_for(
  p_user uuid, p_kind text, p_department_id uuid, p_level_code text, p_course_id uuid,
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
      where p.id = p_user and (p_department_id is null or p.department_id = p_department_id))
    when 'level' then exists (
      select 1 from public.student_placements sp
      where sp.student_id = p_user and sp.status in ('claimed', 'confirmed') and sp.level_code = p_level_code
        and sp.session_id = coalesce(p_session_id, public.current_session_id()))
    when 'offering' then exists (
      select 1 from public.course_enrollments e
      where e.student_id = p_user and e.status = 'active' and e.offering_id = p_offering_id)
    when 'course' then exists (
      select 1 from public.course_enrollments e
      join public.course_offerings o on o.id = e.offering_id
      where e.student_id = p_user and e.status = 'active' and o.course_id = p_course_id
        and (p_semester_id is null or o.semester_id = p_semester_id))
    else false
  end;
$$;

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
    -- A requested (claimed) or confirmed level for the current session counts.
    select level_code into v_level from public.student_placements
    where student_id = auth.uid() and session_id = public.current_session_id() and status in ('claimed', 'confirmed');
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

create or replace function public.lecture_reminder_candidates(p_from timestamptz, p_to timestamptz)
returns table (
  user_id uuid, lecture_id uuid, course_code text, starts_at timestamptz,
  reminder_minutes smallint, push_enabled boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with lectures as (
    select l.id, l.offering_id, c.course_code, c.level,
           ((l.lecture_date + l.start_time) at time zone 'Africa/Lagos') as starts_at
    from public.lecture_sessions l
    join public.courses c on c.id = l.course_id
    where not l.is_cancelled
      and l.lecture_date between (p_from at time zone 'Africa/Lagos')::date - 1 and (p_to at time zone 'Africa/Lagos')::date + 1
  ),
  audience as (
    select e.student_id as user_id, lec.id as lecture_id
    from lectures lec
    join public.course_enrollments e on e.offering_id = lec.offering_id and e.status = 'active'
    where lec.offering_id is not null
    union
    select sp.student_id, lec.id
    from lectures lec
    join public.student_placements sp
      on sp.level_code = lec.level and sp.status in ('claimed', 'confirmed') and sp.session_id = public.current_session_id()
    where lec.offering_id is null
  )
  select a.user_id, lec.id, lec.course_code, lec.starts_at, np.lecture_reminder_minutes, np.push_enabled
  from audience a
  join lectures lec on lec.id = a.lecture_id
  join public.notification_preferences np on np.user_id = a.user_id
  where lec.starts_at >= p_from and lec.starts_at < p_to
    and np.lecture_reminders_enabled
    and public.notification_eligible(a.user_id);
$$;
