-- Reverse of 038_notification_targeting.sql. Restore the caller-only audience_matches first.
create or replace function public.audience_matches(
  p_kind text, p_department_id uuid, p_level_code text, p_course_id uuid,
  p_offering_id uuid, p_session_id uuid, p_semester_id uuid
)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select case p_kind
    when 'department' then exists (select 1 from public.profiles p where p.id = auth.uid() and (p_department_id is null or p.department_id = p_department_id))
    when 'level' then exists (select 1 from public.student_placements sp where sp.student_id = auth.uid() and sp.status = 'confirmed' and sp.level_code = p_level_code and sp.session_id = coalesce(p_session_id, public.current_session_id()))
    when 'offering' then exists (select 1 from public.course_enrollments e where e.student_id = auth.uid() and e.status = 'active' and e.offering_id = p_offering_id)
    when 'course' then exists (select 1 from public.course_enrollments e join public.course_offerings o on o.id = e.offering_id where e.student_id = auth.uid() and e.status = 'active' and o.course_id = p_course_id and (p_semester_id is null or o.semester_id = p_semester_id))
    else false
  end;
$$;
drop function if exists public.lecture_reminder_candidates(timestamptz, timestamptz);
drop function if exists public.announcement_recipients(uuid);
drop function if exists public.notification_eligible(uuid);
drop function if exists public.audience_matches_for(uuid, text, uuid, text, uuid, uuid, uuid, uuid);
