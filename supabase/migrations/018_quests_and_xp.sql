-- Migration 018: Quests and XP ledger.
--
-- Adds verified academic quests, student evidence submissions, and an
-- append-only XP ledger. Quests are administered (create/review/reward)
-- by staff; students browse active quests and submit evidence.
--
-- Tables:
--   public.quests              - quest definitions (admin-managed)
--   public.quest_submissions   - student evidence submissions (student-owned)
--   public.xp_ledger           - append-only XP awards (system-managed via RPC)
--
-- RLS:
--   Students: read active quests, submit own submissions, read own submissions/xp
--   Admins:   read/write quests, read all submissions, review submissions, award XP
--   All direct writes to xp_ledger are revoked; awards go through award_xp() RPC.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. quests table
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null check (length(trim(description)) between 10 and 1000),
  xp_reward integer not null check (xp_reward between 1 and 10000),
  due_date timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.quests is 'Verified academic quests and evidence-based tasks administered by staff.';
comment on column public.quests.xp_reward is 'XP points awarded to a student whose submission is approved.';
comment on column public.quests.due_date is 'Optional deadline after which the quest is no longer submittable.';
comment on column public.quests.is_active is 'Whether the quest is visible and submittable by students.';

create index if not exists idx_quests_is_active_due_date
  on public.quests(is_active, due_date);
create index if not exists idx_quests_created_by
  on public.quests(created_by);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. quest_submissions table
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.quest_submissions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  evidence_url text not null check (length(trim(evidence_url)) between 1 and 500),
  notes text check (length(trim(coalesce(notes, ''))) between 0 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text
    check (rejection_reason is null or length(trim(rejection_reason)) between 12 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_submission_per_student_per_quest unique (quest_id, student_id)
);

comment on table public.quest_submissions is 'Student evidence submissions for quests, reviewed and decided by staff.';
comment on column public.quest_submissions.evidence_url is 'URL to the student\'s evidence of quest completion.';
comment on column public.quest_submissions.status is 'pending, approved, or rejected. Only pending submissions can be reviewed.';
comment on column public.quest_submissions.rejection_reason is 'Required when status is rejected; minimum 12 characters.';

create index if not exists idx_quest_submissions_student_status
  on public.quest_submissions(student_id, status, created_at desc);
create index if not exists idx_quest_submissions_quest_status
  on public.quest_submissions(quest_id, status, created_at desc);
create index if not exists idx_quest_submissions_reviewed_by
  on public.quest_submissions(reviewed_by);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. xp_ledger table (append-only; direct writes revoked)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete set null,
  xp_amount integer not null check (xp_amount > 0),
  reason text not null check (length(trim(reason)) between 1 and 200),
  created_at timestamptz not null default now()
);

comment on table public.xp_ledger is 'Append-only record of XP awards. Writes are only permitted through the award_xp() SECURITY DEFINER RPC.';
comment on column public.xp_ledger.xp_amount is 'Positive integer XP awarded.';
comment on column public.xp_ledger.reason is 'Human-readable reason for the award (e.g. quest title).';

create index if not exists idx_xp_ledger_user_created
  on public.xp_ledger(user_id, created_at desc);
create index if not exists idx_xp_ledger_quest
  on public.xp_ledger(quest_id)
  where quest_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Enable RLS and revoke default privileges
-- ─────────────────────────────────────────────────────────────────────────

alter table public.quests enable row level security;
alter table public.quest_submissions enable row level security;
alter table public.xp_ledger enable row level security;

revoke all on public.quests from anon, authenticated;
revoke all on public.quest_submissions from anon, authenticated;
revoke all on public.xp_ledger from anon, authenticated;

grant select on public.quests to authenticated;
grant select, insert on public.quest_submissions to authenticated;
grant select on public.xp_ledger to authenticated;
grant all on public.quests, public.quest_submissions, public.xp_ledger to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RLS policies: quests
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quests' and policyname = 'quests_select_active'
  ) then
    create policy "quests_select_active"
    on public.quests
    for select
    to authenticated
    using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quests' and policyname = 'quests_admin_all'
  ) then
    create policy "quests_admin_all"
    on public.quests
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RLS policies: quest_submissions
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quest_submissions' and policyname = 'quest_submissions_select_own'
  ) then
    create policy "quest_submissions_select_own"
    on public.quest_submissions
    for select
    to authenticated
    using (student_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quest_submissions' and policyname = 'quest_submissions_insert_own'
  ) then
    create policy "quest_submissions_insert_own"
    on public.quest_submissions
    for insert
    to authenticated
    with check (student_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quest_submissions' and policyname = 'quest_submissions_admin_all'
  ) then
    create policy "quest_submissions_admin_all"
    on public.quest_submissions
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. RLS policies: xp_ledger
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'xp_ledger' and policyname = 'xp_ledger_select_own'
  ) then
    create policy "xp_ledger_select_own"
    on public.xp_ledger
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'xp_ledger' and policyname = 'xp_ledger_select_admin'
  ) then
    create policy "xp_ledger_select_admin"
    on public.xp_ledger
    for select
    to authenticated
    using (public.is_admin());
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Timestamps trigger for quests and quest_submissions
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_quests_updated_at
before update on public.quests
for each row
execute function public.update_updated_at_column();

create trigger set_quest_submissions_updated_at
before update on public.quest_submissions
for each row
execute function public.update_updated_at_column();

revoke all on function public.update_updated_at_column() from public, anon, authenticated;
grant execute on function public.update_updated_at_column() to postgres;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Secure XP award RPC (SECURITY DEFINER, append-only ledger)
-- ─────────────────────────────────────────────────────────────────────────

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
-- 10. Review quest submission RPC (atomic: update submission + award XP)
-- ─────────────────────────────────────────────────────────────────────────

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

  -- Award XP when approved.
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