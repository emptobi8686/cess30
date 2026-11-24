-- Migration 037: Audience- and verification-aware read policies (E5).
--
-- Students see announcements, quests and lectures only through can_view_* (deny by
-- default). Staff writes for announcements and quests move from the legacy scope/level
-- columns to audiences: an administrator manages everything; a course representative may
-- create items and manages those whose every audience lies in their scope
-- (can_manage_*), and can only target their own scope (replace_audiences).
-- Applied as one transaction; supabase/rollback/037_audience_rls_down.sql reverses it.

-- Announcements -------------------------------------------------------------------------
drop policy if exists "announcements_select_authenticated" on public.announcements;
drop policy if exists "announcements_select_scoped" on public.announcements;
drop policy if exists "announcements_select_visible" on public.announcements;
drop policy if exists "announcements_select_manage" on public.announcements;
create policy "announcements_select_visible" on public.announcements for select to authenticated
  using (is_published and published_at <= now() and public.can_view_announcement(id));
create policy "announcements_select_manage" on public.announcements for select to authenticated
  using (public.can_manage_announcement(id));

drop policy if exists "announcements_insert_scoped" on public.announcements;
drop policy if exists "announcements_update_scoped" on public.announcements;
drop policy if exists "announcements_delete_scoped" on public.announcements;
create policy "announcements_insert_scoped" on public.announcements for insert to authenticated
  with check (created_by = auth.uid() and public.holds_capability('level_coordinator'));
create policy "announcements_update_scoped" on public.announcements for update to authenticated
  using (public.can_manage_announcement(id)) with check (public.can_manage_announcement(id));
create policy "announcements_delete_scoped" on public.announcements for delete to authenticated
  using (public.can_manage_announcement(id));

-- Quests ---------------------------------------------------------------------------------------
drop policy if exists "quests_select_active" on public.quests;
drop policy if exists "quests_select_scoped" on public.quests;
drop policy if exists "quests_select_visible" on public.quests;
drop policy if exists "quests_select_manage" on public.quests;
create policy "quests_select_visible" on public.quests for select to authenticated
  using (is_active and public.can_view_quest(id));
create policy "quests_select_manage" on public.quests for select to authenticated
  using (public.can_manage_quest(id));

drop policy if exists "quests_insert_scoped" on public.quests;
drop policy if exists "quests_update_scoped" on public.quests;
drop policy if exists "quests_delete_scoped" on public.quests;
create policy "quests_insert_scoped" on public.quests for insert to authenticated
  with check (created_by = auth.uid() and public.holds_capability('level_coordinator'));
create policy "quests_update_scoped" on public.quests for update to authenticated
  using (public.can_manage_quest(id)) with check (public.can_manage_quest(id));
create policy "quests_delete_scoped" on public.quests for delete to authenticated
  using (public.can_manage_quest(id));

drop policy if exists "quest_submissions_select_scoped" on public.quest_submissions;
create policy "quest_submissions_select_scoped" on public.quest_submissions for select to authenticated
  using (public.can_manage_quest(quest_id));

drop policy if exists "quest_submissions_insert_own" on public.quest_submissions;
create policy "quest_submissions_insert_own" on public.quest_submissions for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and public.quest_is_open(quest_id)
    and public.is_verified_student()
    and public.can_view_quest(quest_id)
  );

-- Lectures ----------------------------------------------------------------------------------
drop policy if exists "lecture_sessions_select_authenticated" on public.lecture_sessions;
drop policy if exists "lecture_sessions_select_visible" on public.lecture_sessions;
create policy "lecture_sessions_select_visible" on public.lecture_sessions for select to authenticated
  using (public.can_view_lecture(id) or public.has_capability('level_coordinator', null, course_id, offering_id));

drop policy if exists "lecture_sessions_insert_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_scoped" on public.lecture_sessions;
create policy "lecture_sessions_insert_scoped" on public.lecture_sessions for insert to authenticated
  with check (created_by = auth.uid() and public.has_capability('level_coordinator', null, course_id, offering_id));
create policy "lecture_sessions_update_scoped" on public.lecture_sessions for update to authenticated
  using (public.has_capability('level_coordinator', null, course_id, offering_id))
  with check (public.has_capability('level_coordinator', null, course_id, offering_id));
create policy "lecture_sessions_delete_scoped" on public.lecture_sessions for delete to authenticated
  using (public.has_capability('level_coordinator', null, course_id, offering_id));

-- Quest review follows quest management.
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

  -- Reviewers are administrators, or course reps whose scope covers every audience of the quest.
  if not public.can_manage_quest(v_quest.id) then
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
-- Items the caller manages (staff lists must not include what a rep merely sees as a student).
create or replace function public.managed_quest_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$ select id from public.quests where public.can_manage_quest(id); $$;

create or replace function public.managed_announcement_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$ select id from public.announcements where public.can_manage_announcement(id); $$;

revoke all on function public.managed_quest_ids(), public.managed_announcement_ids() from public, anon;
grant execute on function public.managed_quest_ids(), public.managed_announcement_ids() to authenticated;
