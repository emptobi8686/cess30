-- Reverse of 037_audience_rls.sql: back to the migration-034 policies (everyone signed in
-- reads published announcements, active quests and all lectures; course reps scoped by
-- announcements.scope/course_id and quests.level_code).

drop function if exists public.managed_quest_ids();
drop function if exists public.managed_announcement_ids();

drop policy if exists "announcements_select_visible" on public.announcements;
drop policy if exists "announcements_select_manage" on public.announcements;
drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated" on public.announcements for select to authenticated
  using (auth.role() = 'authenticated' and is_published = true and published_at <= now());
drop policy if exists "announcements_select_scoped" on public.announcements;
create policy "announcements_select_scoped" on public.announcements for select to authenticated
  using (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id));
drop policy if exists "announcements_insert_scoped" on public.announcements;
drop policy if exists "announcements_update_scoped" on public.announcements;
drop policy if exists "announcements_delete_scoped" on public.announcements;
create policy "announcements_insert_scoped" on public.announcements for insert to authenticated
  with check (created_by = auth.uid() and (public.is_admin()
    or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id))));
create policy "announcements_update_scoped" on public.announcements for update to authenticated
  using (public.is_admin() or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)))
  with check (public.is_admin() or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)));
create policy "announcements_delete_scoped" on public.announcements for delete to authenticated
  using (public.is_admin() or (scope = 'course' and course_id is not null and public.has_capability('level_coordinator', null, course_id)));

drop policy if exists "quests_select_visible" on public.quests;
drop policy if exists "quests_select_manage" on public.quests;
drop policy if exists "quests_select_active" on public.quests;
create policy "quests_select_active" on public.quests for select to authenticated using (is_active = true);
drop policy if exists "quests_select_scoped" on public.quests;
create policy "quests_select_scoped" on public.quests for select to authenticated
  using (level_code is not null and public.has_capability('level_coordinator', level_code));
drop policy if exists "quests_insert_scoped" on public.quests;
drop policy if exists "quests_update_scoped" on public.quests;
drop policy if exists "quests_delete_scoped" on public.quests;
create policy "quests_insert_scoped" on public.quests for insert to authenticated
  with check (created_by = auth.uid() and public.has_capability('level_coordinator', level_code));
create policy "quests_update_scoped" on public.quests for update to authenticated
  using (public.has_capability('level_coordinator', level_code)) with check (public.has_capability('level_coordinator', level_code));
create policy "quests_delete_scoped" on public.quests for delete to authenticated
  using (public.has_capability('level_coordinator', level_code));

drop policy if exists "quest_submissions_select_scoped" on public.quest_submissions;
create policy "quest_submissions_select_scoped" on public.quest_submissions for select to authenticated
  using (public.has_capability('level_coordinator', public.quest_level(quest_id)));
drop policy if exists "quest_submissions_insert_own" on public.quest_submissions;
create policy "quest_submissions_insert_own" on public.quest_submissions for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null
    and rejection_reason is null and public.quest_is_open(quest_id) and public.is_verified_student());

drop policy if exists "lecture_sessions_select_visible" on public.lecture_sessions;
drop policy if exists "lecture_sessions_select_authenticated" on public.lecture_sessions;
create policy "lecture_sessions_select_authenticated" on public.lecture_sessions for select to authenticated
  using (auth.role() = 'authenticated');
drop policy if exists "lecture_sessions_insert_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_scoped" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_scoped" on public.lecture_sessions;
create policy "lecture_sessions_insert_scoped" on public.lecture_sessions for insert to authenticated
  with check (created_by = auth.uid() and public.has_capability('level_coordinator', null, course_id));
create policy "lecture_sessions_update_scoped" on public.lecture_sessions for update to authenticated
  using (public.has_capability('level_coordinator', null, course_id)) with check (public.has_capability('level_coordinator', null, course_id));
create policy "lecture_sessions_delete_scoped" on public.lecture_sessions for delete to authenticated
  using (public.has_capability('level_coordinator', null, course_id));

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
