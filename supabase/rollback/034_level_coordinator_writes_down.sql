-- Reverse of 034_level_coordinator_writes.sql: back to administrator-only writes.
-- Run with psql from the repository root:  psql -f supabase/rollback/034_level_coordinator_writes_down.sql
-- Re-applying 032 and 022 restores their admin-only RPC bodies and policies (both are idempotent);
-- the review and XP functions are restored inline from migration 019.
\ir ../migrations/032_placements_enrollments.sql
\ir ../migrations/022_quest_integrity.sql

-- Admin-only review and XP award (bodies from migration 019).
create or replace function public.review_quest_submission(
  p_submission_id uuid,
  p_new_status text,
  p_rejection_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission quest_submissions%rowtype;
  v_quest quests%rowtype;
  v_reviewed_by uuid := auth.uid();
begin
  -- Authenticate.
  if auth.uid() is null then
    raise exception 'Authenticated session required.';
  end if;

  -- Administrator only.
  if not public.is_admin() then
    raise exception 'Administrator access required to review quest submissions.';
  end if;

  -- Prevent self-review.
  if p_submission_id is null then
    raise exception 'Submission is required.';
  end if;

  -- Lock the submission row.
  select * into v_submission
  from public.quest_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Quest submission not found.';
  end if;

  -- Administrators cannot review their own submissions.
  if v_submission.student_id = v_reviewed_by then
    raise exception 'Administrators cannot review their own quest submissions.';
  end if;

  -- Only pending submissions can be reviewed.
  if v_submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed with status: %.', v_submission.status;
  end if;

  -- Validate the decision.
  if p_new_status not in ('approved', 'rejected') then
    raise exception 'Invalid quest submission decision.';
  end if;

  -- Require rejection reason for rejection.
  if p_new_status = 'rejected' and length(trim(coalesce(p_rejection_reason, ''))) < 12 then
    raise exception 'Rejection reason must be at least 12 characters.';
  end if;

  -- Fetch the quest for XP reward info.
  select * into v_quest
  from public.quests
  where id = v_submission.quest_id;

  if not found then
    raise exception 'Referenced quest not found.';
  end if;

  -- Update the submission.
  update public.quest_submissions
  set status = p_new_status,
      reviewed_by = v_reviewed_by,
      reviewed_at = now(),
      rejection_reason = case
        when p_new_status = 'rejected' then trim(p_rejection_reason)
        else null
      end,
      updated_at = now()
  where id = p_submission_id;

  -- Award XP when approved. award_xp() checks for duplicates internally.
  if p_new_status = 'approved' then
    perform public.award_xp(
      p_user_id := v_submission.student_id,
      p_quest_id := v_submission.quest_id,
      p_xp_amount := v_quest.xp_reward,
      p_reason := format('Approved quest submission: %s', v_quest.title)
    );
  end if;

  return format('Quest submission %s moved from pending to %s.', p_submission_id, p_new_status);
end;
$$;

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

  -- Only administrators can award XP.
  if not public.is_admin() then
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

drop policy if exists "courses_insert_scoped" on public.courses;
drop policy if exists "courses_update_scoped" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;
drop policy if exists "courses_manage_admin_only" on public.courses;
create policy "courses_manage_admin_only" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_offerings_insert_scoped" on public.course_offerings;
drop policy if exists "course_offerings_update_scoped" on public.course_offerings;
drop policy if exists "course_offerings_delete_scoped" on public.course_offerings;
drop policy if exists "course_offerings_admin_insert" on public.course_offerings;
drop policy if exists "course_offerings_admin_update" on public.course_offerings;
drop policy if exists "course_offerings_admin_delete" on public.course_offerings;
create policy "course_offerings_admin_insert" on public.course_offerings for insert to authenticated with check (public.is_admin());
create policy "course_offerings_admin_update" on public.course_offerings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "course_offerings_admin_delete" on public.course_offerings for delete to authenticated using (public.is_admin());

drop policy if exists "lecture_sessions_insert_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_insert_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_admin_only" on public.lecture_sessions;
create policy "lecture_sessions_insert_admin_only" on public.lecture_sessions for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "lecture_sessions_update_admin_only" on public.lecture_sessions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lecture_sessions_delete_admin_only" on public.lecture_sessions for delete to authenticated using (public.is_admin());

drop policy if exists "announcements_insert_scoped" on public.announcements;
drop policy if exists "announcements_update_scoped" on public.announcements;
drop policy if exists "announcements_delete_scoped" on public.announcements;
drop policy if exists "announcements_select_scoped" on public.announcements;
drop policy if exists "announcements_insert_admin_only" on public.announcements;
drop policy if exists "announcements_update_admin_only" on public.announcements;
drop policy if exists "announcements_delete_admin_only" on public.announcements;
create policy "announcements_insert_admin_only" on public.announcements for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "announcements_update_admin_only" on public.announcements for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "announcements_delete_admin_only" on public.announcements for delete to authenticated using (public.is_admin());

drop policy if exists "quests_insert_scoped" on public.quests;
drop policy if exists "quests_update_scoped" on public.quests;
drop policy if exists "quests_delete_scoped" on public.quests;
drop policy if exists "quests_select_scoped" on public.quests;
drop policy if exists "quest_submissions_select_scoped" on public.quest_submissions;
drop policy if exists "profiles_select_coordinator" on public.profiles;

drop function if exists public.quest_level(uuid);
drop function if exists public.coordinates_student(uuid);
drop function if exists public.holds_capability(text);
alter table public.quests drop column if exists level_code;
