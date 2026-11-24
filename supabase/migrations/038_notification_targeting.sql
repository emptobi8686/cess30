-- Migration 038: Audience-based notification targeting in SQL (E4/E5).
--
-- Announcement notifications go to verified students who match one of the announcement's
-- audiences; lecture reminders go to students actively enrolled in the lecture's offering
-- (carry-over students included, dropped enrolments excluded), or, for legacy lectures
-- without an offering, to students confirmed at the course's level. Administrators who are
-- not also students are excluded. Service role only (the delivery job and server actions).

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
      where sp.student_id = p_user and sp.status = 'confirmed' and sp.level_code = p_level_code
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

-- One definition of matching: the caller-based helper delegates to the explicit one.
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
  select public.audience_matches_for(auth.uid(), p_kind, p_department_id, p_level_code, p_course_id, p_offering_id, p_session_id, p_semester_id);
$$;

create or replace function public.notification_eligible(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.profiles where id = p_user and verification_status = 'verified')
     and (not exists (select 1 from public.user_roles where user_id = p_user and role = 'admin')
          or exists (select 1 from public.user_roles where user_id = p_user and role = 'student'));
$$;

create or replace function public.announcement_recipients(p_announcement_id uuid)
returns table (user_id uuid, push_enabled boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select np.user_id, np.push_enabled
  from public.notification_preferences np
  where np.announcement_notifications_enabled
    and public.notification_eligible(np.user_id)
    and exists (
      select 1 from public.announcement_audiences a
      where a.announcement_id = p_announcement_id
        and public.audience_matches_for(np.user_id, a.audience_kind, a.department_id, a.level_code,
                                        a.course_id, a.offering_id, a.session_id, a.semester_id));
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
      on sp.level_code = lec.level and sp.status = 'confirmed' and sp.session_id = public.current_session_id()
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

revoke all on function
  public.audience_matches_for(uuid, text, uuid, text, uuid, uuid, uuid, uuid),
  public.notification_eligible(uuid),
  public.announcement_recipients(uuid),
  public.lecture_reminder_candidates(timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.audience_matches_for(uuid, text, uuid, text, uuid, uuid, uuid, uuid),
  public.notification_eligible(uuid),
  public.announcement_recipients(uuid),
  public.lecture_reminder_candidates(timestamptz, timestamptz)
to service_role;
