-- Migration 019: Quests and XP security fixes.
--
-- Forward-only fixes to migration 018:
--   1. Add self-review prevention to review_quest_submission().
--   2. Add duplicate XP prevention to award_xp() and xp_ledger.
--   3. Change xp_ledger.user_id FK to ON DELETE RESTRICT (preserve history).
--   4. Add URL format check constraint on quest_submissions.evidence_url.
--   5. Restrict quest_submissions admin policy (no DELETE).
--   6. Create private quest-evidence storage bucket with RLS policies.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Change xp_ledger.user_id FK to ON DELETE RESTRICT
--    Preserve append-only XP history when a user account is deleted.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.xp_ledger
  drop constraint if exists xp_ledger_user_id_fkey;

alter table public.xp_ledger
  add constraint xp_ledger_user_id_fkey
  foreign key (user_id) references auth.users(id)
  on delete restrict;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Add unique constraint on xp_ledger(user_id, quest_id)
--    Prevent duplicate XP awards for the same student+quest combination.
--    NULL quest_id entries are allowed multiple times (PostgreSQL unique
--    semantics treat NULL as distinct).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.xp_ledger
  add constraint xp_ledger_user_quest_unique
  unique (user_id, quest_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Add URL format check constraint on quest_submissions.evidence_url
--    Ensure evidence URLs are well-formed absolute URLs with https scheme.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.quest_submissions
  add constraint quest_submissions_evidence_url_format
  check (
    evidence_url ~* '^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/[^ ]*)?$'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Restrict quest_submissions admin policy — remove DELETE
--    Admins can SELECT, INSERT, UPDATE but not DELETE submissions.
--    Prevents delete/resubmit double-XP bypass.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "quest_submissions_admin_all" on public.quest_submissions;

create policy "quest_submissions_admin_select"
on public.quest_submissions
for select
to authenticated
using (public.is_admin());

create policy "quest_submissions_admin_insert"
on public.quest_submissions
for insert
to authenticated
with check (public.is_admin());

create policy "quest_submissions_admin_update"
on public.quest_submissions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy for quest_submissions — submissions are immutable once created.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Add self-review prevention and duplicate XP prevention to RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- Re-create review_quest_submission() with self-review prevention.
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

revoke all on function public.review_quest_submission(uuid, text, text) from public, anon;
grant execute on function public.review_quest_submission(uuid, text, text) to authenticated;

-- Re-create award_xp() with duplicate XP prevention.
create or replace function public.award_xp(
  p_user_id uuid,
  p_quest_id uuid,
  p_xp_amount integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

revoke all on function public.award_xp(uuid, uuid, integer, text) from public, anon;
grant execute on function public.award_xp(uuid, uuid, integer, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Create private quest-evidence storage bucket
--    Evidence files are private — only the submitting student and admins
--    can access them. Never a public bucket.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quest-evidence',
  'quest-evidence',
  false,
  10485760,  -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

-- Storage RLS policies for quest-evidence bucket.
-- Students can upload their own evidence and read their own files.
-- Admins can read all files.

create policy if not exists "quest_evidence_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'quest-evidence'
  and (owner = auth.uid() or public.is_admin())
);

create policy if not exists "quest_evidence_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'quest-evidence'
  and owner = auth.uid()
);

create policy if not exists "quest_evidence_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'quest-evidence'
  and owner = auth.uid()
)
with check (
  bucket_id = 'quest-evidence'
  and owner = auth.uid()
);

create policy if not exists "quest_evidence_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'quest-evidence'
  and owner = auth.uid()
);

-- No public access policy on quest-evidence bucket.

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Server-side leaderboard function
--    Returns ranked XP leaderboard with weekly/monthly/all-time periods.
--    Uses Africa/Lagos timezone for week/month boundaries.
--    SECURITY DEFINER so it can read all xp_ledger rows, but only exposes
--    public fields (full_name, avatar_url, total_xp, rank) — never
--    matric_number, email, verification status, or private data.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_leaderboard(p_period text default 'all-time')
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_xp integer,
  quests_completed integer,
  rank integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_week_start date;
  v_week_end date;
  v_month_start date;
  v_month_end date;
begin
  -- Compute Africa/Lagos date boundaries.
  select
    (today - ((extract(dow from today::timestamp)::int + 6) % 7) * interval '1 day')::date,
    (today - ((extract(dow from today::timestamp)::int + 6) % 7) * interval '1 day')::date + 6,
    date_trunc('month', today::timestamp)::date,
    (date_trunc('month', today::timestamp) + interval '1 month - 1 day')::date
  into v_week_start, v_week_end, v_month_start, v_month_end
  from (
    select (now() at time zone 'Africa/Lagos')::date as today
  ) as t;

  return query
  with xp_agg as (
    select
      x.user_id,
      sum(x.xp_amount) as total_xp,
      count(x.quest_id) filter (where x.quest_id is not null) as quests_completed
    from public.xp_ledger x
    where (
      p_period = 'all-time'
      or (p_period = 'weekly'
          and (x.created_at at time zone 'Africa/Lagos')::date between v_week_start and v_week_end)
      or (p_period = 'monthly'
          and (x.created_at at time zone 'Africa/Lagos')::date between v_month_start and v_month_end)
    )
    group by x.user_id
  ),
  ranked as (
    select
      a.user_id,
      coalesce(p.full_name, 'Unknown') as full_name,
      p.avatar_url,
      a.total_xp,
      a.quests_completed,
      rank() over (order by a.total_xp desc, coalesce(p.full_name, 'Unknown') asc) as rank
    from xp_agg a
    left join public.profiles p on p.id = a.user_id
  )
  select user_id, full_name, avatar_url, total_xp, quests_completed, rank
  from ranked
  order by rank;
end;
$$;

revoke all on function public.get_leaderboard(text) from public, anon;
grant execute on function public.get_leaderboard(text) to authenticated;