-- Migration 022: Quest and XP integrity (audit findings BP-014, BP-015, BP-008).
--
--   * Students may insert only the submission columns they own (quest, evidence, notes),
--     only as pending, only for quests that are active and not overdue.
--   * award_xp() is no longer callable by API roles; XP is awarded only through
--     review_quest_submission() (which runs as the function owner).
--   * Quests: split admin policies; INSERT requires created_by = auth.uid().
--     018 granted authenticated SELECT only, so admins could not create or edit
--     quests through the API at all; table grants are added and RLS remains the gate.

-- 1. Open-quest helper used by the submission policy.
create or replace function public.quest_is_open(p_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.quests q
    where q.id = p_quest_id
      and q.is_active
      and (q.due_date is null or q.due_date > now())
  );
$$;

revoke all on function public.quest_is_open(uuid) from public, anon;
grant execute on function public.quest_is_open(uuid) to authenticated, service_role;

-- 2. Submissions: column-restricted insert and an honest-row policy.
revoke insert on public.quest_submissions from authenticated;
grant insert (quest_id, student_id, evidence_url, notes) on public.quest_submissions to authenticated;

drop policy if exists "quest_submissions_insert_own" on public.quest_submissions;
create policy "quest_submissions_insert_own"
on public.quest_submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
  and public.quest_is_open(quest_id)
);

-- Administrators create submissions only through student accounts; remove the
-- 019 admin insert path that allowed arbitrary statuses.
drop policy if exists "quest_submissions_admin_insert" on public.quest_submissions;

-- 3. XP awards only through the review RPC.
revoke execute on function public.award_xp(uuid, uuid, integer, text) from authenticated;

-- 4. Quests: grants plus split admin policies.
grant insert, update, delete on public.quests to authenticated;

drop policy if exists "quests_admin_all" on public.quests;
drop policy if exists "quests_admin_select" on public.quests;
drop policy if exists "quests_admin_insert" on public.quests;
drop policy if exists "quests_admin_update" on public.quests;
drop policy if exists "quests_admin_delete" on public.quests;

create policy "quests_admin_select"
on public.quests for select to authenticated
using (public.is_admin());

create policy "quests_admin_insert"
on public.quests for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "quests_admin_update"
on public.quests for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "quests_admin_delete"
on public.quests for delete to authenticated
using (public.is_admin());

-- Authorship is immutable after creation.
drop trigger if exists quests_protect_audit on public.quests;
create trigger quests_protect_audit
before update on public.quests
for each row
execute function public.prevent_audit_column_changes();
