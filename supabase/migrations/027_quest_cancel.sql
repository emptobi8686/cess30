-- Migration 027: Students can cancel pending quest submissions (audit finding BP-029).
--
--   * status gains 'cancelled'.
--   * "one submission per student per quest" now applies to non-cancelled rows only,
--     so a student can resubmit after cancelling.
--   * cancel_quest_submission(id): owner only, pending only.

alter table public.quest_submissions
  drop constraint if exists quest_submissions_status_check;
alter table public.quest_submissions
  add constraint quest_submissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

alter table public.quest_submissions
  drop constraint if exists one_submission_per_student_per_quest;
create unique index if not exists quest_submissions_one_active_per_student
  on public.quest_submissions (quest_id, student_id)
  where status <> 'cancelled';

create or replace function public.cancel_quest_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authenticated session required.';
  end if;

  select student_id, status into v_owner, v_status
  from public.quest_submissions
  where id = p_submission_id
  for update;

  if not found or v_owner <> auth.uid() then
    raise exception 'Submission not found.';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only pending submissions can be cancelled.';
  end if;

  update public.quest_submissions
  set status = 'cancelled', updated_at = now()
  where id = p_submission_id;
end;
$$;

revoke all on function public.cancel_quest_submission(uuid) from public, anon;
grant execute on function public.cancel_quest_submission(uuid) to authenticated;
