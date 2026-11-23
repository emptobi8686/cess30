-- Migration 025: Verification-aware student writes (audit finding BP-005, database layer).
--
-- Only verified students may create or change study sessions and quest submissions.
-- Every status keeps SELECT and DELETE on its own study sessions (data portability).
-- Application guards enforce the same rule; this is defence in depth.

create or replace function public.is_verified_student()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.verification_status = 'verified'
  );
$$;

revoke all on function public.is_verified_student() from public, anon;
grant execute on function public.is_verified_student() to authenticated, service_role;

drop policy if exists "study_sessions_insert_own" on public.study_sessions;
create policy "study_sessions_insert_own"
on public.study_sessions
for insert
to authenticated
with check (auth.uid() = user_id and public.is_verified_student());

drop policy if exists "study_sessions_update_own" on public.study_sessions;
create policy "study_sessions_update_own"
on public.study_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and public.is_verified_student());

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
  and public.is_verified_student()
);
