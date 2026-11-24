-- Migration 034: Course representatives run their own level (decision 0004, E6).
--
-- Write access moves from is_admin() to has_capability('level_coordinator', <level>).
-- has_capability() is true for administrators and department admins everywhere, so
-- existing admins keep every power. A course representative (level coordinator) may,
-- for their level only: add and edit courses (not delete), create offerings, manage the
-- timetable, post course announcements, create level quests and review their
-- submissions, confirm placements and manage enrolments. Never: verification, granting,
-- department-wide announcements or quests, own placement, own quest submission.
-- Until the audience model (P6) lands, a quest's audience is quests.level_code
-- (null = department-wide, administrators only).

-- Helpers ------------------------------------------------------------------------------
create or replace function public.holds_capability(p_cap text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.user_has_capability(auth.uid(), 'department_admin')
      or exists (
        select 1 from public.staff_assignments
        where user_id = auth.uid() and capability = p_cap and status = 'active'
          and revoked_at is null and (expires_at is null or expires_at > now())
      );
$$;

-- True when the caller coordinates a level this student is placed in (current session)
-- or enrolled at. Used to let course representatives read their classmates' profiles.
create or replace function public.coordinates_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.student_placements p
    where p.student_id = p_student and p.session_id = public.current_session_id()
      and public.has_capability('level_coordinator', p.level_code)
  ) or exists (
    select 1 from public.course_enrollments e
    join public.course_offerings o on o.id = e.offering_id
    where e.student_id = p_student and e.status = 'active'
      and public.has_capability('level_coordinator', o.level_code)
  );
$$;

revoke all on function public.holds_capability(text) from public, anon;
revoke all on function public.coordinates_student(uuid) from public, anon;
grant execute on function public.holds_capability(text) to authenticated;
grant execute on function public.coordinates_student(uuid) to authenticated;

-- Quests gain a level audience ---------------------------------------------------------
alter table public.quests add column if not exists level_code text references public.academic_levels(code);
create index if not exists quests_level_idx on public.quests (level_code);
grant insert (level_code), update (level_code) on public.quests to authenticated;

create or replace function public.quest_level(p_quest uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$ select level_code from public.quests where id = p_quest; $$;
revoke all on function public.quest_level(uuid) from public, anon;
grant execute on function public.quest_level(uuid) to authenticated;

-- Courses --------------------------------------------------------------------------------
drop policy if exists "courses_manage_admin_only" on public.courses;
drop policy if exists "courses_insert_scoped" on public.courses;
drop policy if exists "courses_update_scoped" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;
create policy "courses_insert_scoped" on public.courses for insert to authenticated
  with check (public.has_capability('level_coordinator', level));
create policy "courses_update_scoped" on public.courses for update to authenticated
  using (public.has_capability('level_coordinator', level))
  with check (public.has_capability('level_coordinator', level));
create policy "courses_delete_admin" on public.courses for delete to authenticated
  using (public.is_admin());

-- Offerings ------------------------------------------------------------------------------
drop policy if exists "course_offerings_admin_insert" on public.course_offerings;
drop policy if exists "course_offerings_admin_update" on public.course_offerings;
drop policy if exists "course_offerings_admin_delete" on public.course_offerings;
drop policy if exists "course_offerings_insert_scoped" on public.course_offerings;
drop policy if exists "course_offerings_update_scoped" on public.course_offerings;
drop policy if exists "course_offerings_delete_scoped" on public.course_offerings;
create policy "course_offerings_insert_scoped" on public.course_offerings for insert to authenticated
  with check (public.has_capability('level_coordinator', level_code));
create policy "course_offerings_update_scoped" on public.course_offerings for update to authenticated
  using (public.has_capability('level_coordinator', level_code))
  with check (public.has_capability('level_coordinator', level_code));
create policy "course_offerings_delete_scoped" on public.course_offerings for delete to authenticated
  using (public.has_capability('level_coordinator', level_code));

-- Timetable ------------------------------------------------------------------------------
drop policy if exists "lecture_sessions_insert_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_insert_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_scoped" on public.lecture_sessions;
create policy "lecture_sessions_insert_scoped" on public.lecture_sessions for insert to authenticated
  with check (created_by = auth.uid() and public.has_capability('level_coordinator', null, course_id));
create policy "lecture_sessions_update_scoped" on public.lecture_sessions for update to authenticated
  using (public.has_capability('level_coordinator', null, course_id))
  with check (public.has_capability('level_coordinator', null, course_id));
create policy "lecture_sessions_delete_scoped" on public.lecture_sessions for delete to authenticated
  using (public.has_capability('level_coordinator', null, course_id));

-- Announcements: department-wide stays with administrators; reps post course announcements.
drop policy if exists "announcements_insert_admin_only" on public.announcements;
drop policy if exists "announcements_update_admin_only" on public.announcements;
drop policy if exists "announcements_delete_admin_only" on public.announcements;
drop policy if exists "announcements_insert_scoped" on public.announcements;
drop policy if exists "announcements_update_scoped" on public.announcements;
drop policy if exists "announcements_delete_scoped" on public.announcements;
drop policy if exists "announcements_select_scoped" on public.announcements;
create policy "announcements_insert_scoped" on public.announcements for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_admin()
         or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)))
  );
create policy "announcements_update_scoped" on public.announcements for update to authenticated
  using (public.is_admin()
         or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)))
  with check (public.is_admin()
         or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)));
create policy "announcements_delete_scoped" on public.announcements for delete to authenticated
  using (public.is_admin()
         or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)));
create policy "announcements_select_scoped" on public.announcements for select to authenticated
  using (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id));

-- Quests -----------------------------------------------------------------------------------
drop policy if exists "quests_admin_insert" on public.quests;
drop policy if exists "quests_admin_update" on public.quests;
drop policy if exists "quests_admin_delete" on public.quests;
drop policy if exists "quests_insert_scoped" on public.quests;
drop policy if exists "quests_update_scoped" on public.quests;
drop policy if exists "quests_delete_scoped" on public.quests;
drop policy if exists "quests_select_scoped" on public.quests;
create policy "quests_insert_scoped" on public.quests for insert to authenticated
  with check (created_by = auth.uid() and public.has_capability('level_coordinator', level_code));
create policy "quests_update_scoped" on public.quests for update to authenticated
  using (public.has_capability('level_coordinator', level_code))
  with check (public.has_capability('level_coordinator', level_code));
create policy "quests_delete_scoped" on public.quests for delete to authenticated
  using (public.has_capability('level_coordinator', level_code));
create policy "quests_select_scoped" on public.quests for select to authenticated
  using (level_code is not null and public.has_capability('level_coordinator', level_code));

drop policy if exists "quest_submissions_select_scoped" on public.quest_submissions;
create policy "quest_submissions_select_scoped" on public.quest_submissions for select to authenticated
  using (public.has_capability('level_coordinator', public.quest_level(quest_id)));

-- Placements, enrolments, classmates' profiles -----------------------------------------
drop policy if exists "student_placements_select" on public.student_placements;
create policy "student_placements_select" on public.student_placements for select to authenticated
  using (student_id = auth.uid() or public.has_capability('level_coordinator', level_code));

drop policy if exists "course_enrollments_select" on public.course_enrollments;
create policy "course_enrollments_select" on public.course_enrollments for select to authenticated
  using (student_id = auth.uid() or public.has_capability('level_coordinator', null, null, offering_id));

drop policy if exists "profiles_select_coordinator" on public.profiles;
create policy "profiles_select_coordinator" on public.profiles for select to authenticated
  using (public.coordinates_student(id));

-- RPCs -----------------------------------------------------------------------------------
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
  if not public.holds_capability('level_coordinator') then raise exception 'Administrator access required.'; end if;
  if p_status not in ('confirmed', 'rejected') then raise exception 'Choose confirm or reject.'; end if;

  for v_row in
    select * from public.student_placements where id = any(p_placement_ids) for update
  loop
    if v_row.student_id = v_uid then
      raise exception 'You cannot confirm your own placement.';
    end if;
    if not public.has_capability('level_coordinator', v_row.level_code) then
      raise exception 'You can only confirm placements for levels you coordinate.';
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

create or replace function public.enroll_level_core(p_semester_id uuid, p_level_code text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if not public.holds_capability('level_coordinator') then raise exception 'Administrator access required.'; end if;
  if not public.has_capability('level_coordinator', p_level_code) then
    raise exception 'You can only manage enrolments for levels you coordinate.';
  end if;

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

create or replace function public.enroll_student(p_student_id uuid, p_offering_id uuid, p_type text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if not public.holds_capability('level_coordinator') then raise exception 'Administrator access required.'; end if;
  if not public.has_capability('level_coordinator', null, null, p_offering_id) then
    raise exception 'You can only manage enrolments for levels you coordinate.';
  end if;
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
declare
  v_offering uuid;
begin
  if not public.holds_capability('level_coordinator') then raise exception 'Administrator access required.'; end if;
  if p_status not in ('active', 'dropped', 'completed') then raise exception 'Invalid enrolment status.'; end if;
  select offering_id into v_offering from public.course_enrollments where id = p_enrollment_id;
  if v_offering is null then raise exception 'Enrolment not found.'; end if;
  if not public.has_capability('level_coordinator', null, null, v_offering) then
    raise exception 'You can only manage enrolments for levels you coordinate.';
  end if;
  update public.course_enrollments set status = p_status where id = p_enrollment_id;
end;
$$;

create or replace function public.review_quest_submission(p_submission_id uuid, p_new_status text, p_rejection_reason text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission public.quest_submissions%rowtype;
  v_quest public.quests%rowtype;
  v_reviewed_by uuid := auth.uid();
begin
  if v_reviewed_by is null then raise exception 'Authenticated session required.'; end if;
  if not public.holds_capability('level_coordinator') then
    raise exception 'Administrator access required to review quest submissions.';
  end if;
  if p_submission_id is null then raise exception 'Submission is required.'; end if;

  select * into v_submission from public.quest_submissions where id = p_submission_id for update;
  if not found then raise exception 'Quest submission not found.'; end if;

  select * into v_quest from public.quests where id = v_submission.quest_id;
  if not found then raise exception 'Referenced quest not found.'; end if;

  -- Department-wide quests (no level) are reviewed by administrators only.
  if not public.has_capability('level_coordinator', v_quest.level_code) then
    raise exception 'You cannot review submissions for this quest.';
  end if;

  if v_submission.student_id = v_reviewed_by then
    raise exception 'Administrators cannot review their own quest submissions.';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed with status: %.', v_submission.status;
  end if;
  if p_new_status not in ('approved', 'rejected') then
    raise exception 'Invalid quest submission decision.';
  end if;
  if p_new_status = 'rejected' and length(trim(coalesce(p_rejection_reason, ''))) < 12 then
    raise exception 'Rejection reason must be at least 12 characters.';
  end if;

  update public.quest_submissions
  set status = p_new_status,
      reviewed_by = v_reviewed_by,
      reviewed_at = now(),
      rejection_reason = case when p_new_status = 'rejected' then trim(p_rejection_reason) else null end,
      updated_at = now()
  where id = p_submission_id;

  if p_new_status = 'approved' then
    perform set_config('blueprint.quest_review_rpc', 'on', true);
    perform public.award_xp(
      p_user_id := v_submission.student_id,
      p_quest_id := v_submission.quest_id,
      p_xp_amount := v_quest.xp_reward,
      p_reason := format('Approved quest submission: %s', v_quest.title)
    );
    perform set_config('blueprint.quest_review_rpc', 'off', true);
  end if;

  return format('Quest submission %s moved from pending to %s.', p_submission_id, p_new_status);
end;
$$;

-- award_xp stays non-executable by clients (migration 022); it now also accepts an award
-- made inside an authorised review_quest_submission call.
create or replace function public.award_xp(p_user_id uuid, p_quest_id uuid, p_xp_amount integer, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $$
declare
  v_ledger_id uuid;
begin
  -- Only authenticated sessions can call this.
  if auth.uid() is null then
    raise exception 'Authenticated session required.';
  end if;

  -- Administrators, or a quest review already authorised by review_quest_submission
  -- (transaction-local flag; award_xp is not executable by clients).
  if not public.is_admin() and current_setting('blueprint.quest_review_rpc', true) is distinct from 'on' then
    raise exception 'Administrator access required to award XP.';
  end if;

  -- Validate inputs.
  if p_user_id is null then
    raise exception 'User is required.';
  end if;

  if p_xp_amount is null or p_xp_amount <= 0 then
    raise exception 'XP amount must be a positive integer.';
  end if;

  if p_xp_amount > 10000 then
    raise exception 'XP amount cannot exceed 10000 per award.';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 1 or length(trim(coalesce(p_reason, ''))) > 200 then
    raise exception 'Reason must be between 1 and 200 characters.';
  end if;

  -- Optional: validate quest exists when provided.
  if p_quest_id is not null then
    if not exists (
      select 1 from public.quests where id = p_quest_id
    ) then
      raise exception 'Referenced quest does not exist.';
    end if;

    -- Duplicate prevention: do not award XP twice for the same user+quest.
    -- The unique constraint xp_ledger_user_quest_unique also enforces this
    -- at the database level, but we check here to return a clear error.
    if exists (
      select 1
      from public.xp_ledger
      where user_id = p_user_id
        and quest_id = p_quest_id
    ) then
      raise exception 'XP already awarded for user % on quest %.', p_user_id, p_quest_id;
    end if;
  end if;

  -- Insert the ledger record (append-only).
  insert into public.xp_ledger (
    user_id,
    quest_id,
    xp_amount,
    reason,
    created_at
  )
  values (
    p_user_id,
    p_quest_id,
    p_xp_amount,
    trim(p_reason),
    now()
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$
;
revoke execute on function public.award_xp(uuid, uuid, integer, text) from public, anon, authenticated;
