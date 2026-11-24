-- Migration 036: Non-destructive legacy backfill with a review queue (E4 part 2).
--
-- Maps pre-expansion data into the audience model where the mapping is unambiguous and
-- queues everything else for an administrator (department-expansion/03 §2). Never guesses:
-- legacy "level" announcements stay hidden until someone chooses their level.
-- run_legacy_backfill() is idempotent; administrators may re-run it (for example after
-- opening the first academic session, which placements need).

create table if not exists public.migration_review_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('placement', 'offering_semester', 'announcement_level', 'quest_audience', 'lecture_out_of_range', 'profile_no_matric')),
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint migration_review_items_unique unique (item_type, entity_id)
);
create index if not exists migration_review_items_open_idx on public.migration_review_items (item_type) where status = 'open';

alter table public.migration_review_items enable row level security;
revoke all on public.migration_review_items from anon, authenticated;
grant select, update (status, resolved_by, resolved_at) on public.migration_review_items to authenticated;
grant all on public.migration_review_items to service_role;
drop policy if exists "migration_review_items_admin_select" on public.migration_review_items;
create policy "migration_review_items_admin_select" on public.migration_review_items for select to authenticated
  using (public.is_admin());
drop policy if exists "migration_review_items_admin_update" on public.migration_review_items;
create policy "migration_review_items_admin_update" on public.migration_review_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.run_legacy_backfill()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session uuid := public.current_session_id();
  v_dept uuid;
  v_placements integer := 0;
  v_audiences integer := 0;
  v_lectures integer := 0;
  v_items integer := 0;
  n integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  select id into v_dept from public.departments where code = 'CVE';

  -- Placements: a claimed placement at the cached profile level, queued for confirmation.
  if v_session is not null then
    insert into public.student_placements (student_id, session_id, level_code, status, source)
    select p.id, v_session, p.level, 'claimed', 'legacy_backfill'
    from public.profiles p
    where p.level in (select code from public.academic_levels)
      and p.verification_status <> 'suspended'
      and not exists (select 1 from public.student_placements sp where sp.student_id = p.id and sp.session_id = v_session);
    get diagnostics v_placements = row_count;

    insert into public.migration_review_items (item_type, entity_id, details)
    select 'placement', sp.id, jsonb_build_object('student_id', sp.student_id, 'level_code', sp.level_code)
    from public.student_placements sp
    where sp.source = 'legacy_backfill' and sp.status = 'claimed'
    on conflict (item_type, entity_id) do nothing;
    get diagnostics n = row_count; v_items := v_items + n;
  end if;

  -- Announcements without any audience.
  insert into public.announcement_audiences (announcement_id, audience_kind, department_id)
  select a.id, 'department', v_dept
  from public.announcements a
  where a.scope in ('all', 'department')
    and not exists (select 1 from public.announcement_audiences x where x.announcement_id = a.id);
  get diagnostics n = row_count; v_audiences := v_audiences + n;

  insert into public.announcement_audiences (announcement_id, audience_kind, offering_id, course_id)
  select a.id,
         case when o.offering_id is not null then 'offering' else 'course' end,
         o.offering_id,
         case when o.offering_id is null then a.course_id end
  from public.announcements a
  join public.courses c on c.id = a.course_id
  cross join lateral (
    select public.offering_for(a.course_id, (a.published_at at time zone 'Africa/Lagos')::date, c.level) as offering_id
  ) o
  where a.scope = 'course'
    and not exists (select 1 from public.announcement_audiences x where x.announcement_id = a.id);
  get diagnostics n = row_count; v_audiences := v_audiences + n;

  insert into public.migration_review_items (item_type, entity_id, details)
  select 'announcement_level', a.id, jsonb_build_object('title', a.title, 'suggested_level', '200')
  from public.announcements a
  where a.scope = 'level'
    and not exists (select 1 from public.announcement_audiences x where x.announcement_id = a.id)
  on conflict (item_type, entity_id) do nothing;
  get diagnostics n = row_count; v_items := v_items + n;

  -- Lectures get their offering when one covers the date.
  update public.lecture_sessions l
  set offering_id = public.offering_for(l.course_id, l.lecture_date, c.level)
  from public.courses c
  where c.id = l.course_id and l.offering_id is null
    and public.offering_for(l.course_id, l.lecture_date, c.level) is not null;
  get diagnostics v_lectures = row_count;

  insert into public.migration_review_items (item_type, entity_id, details)
  select 'lecture_out_of_range', l.id, jsonb_build_object('course_id', l.course_id, 'lecture_date', l.lecture_date)
  from public.lecture_sessions l
  where l.offering_id is null
  on conflict (item_type, entity_id) do nothing;
  get diagnostics n = row_count; v_items := v_items + n;

  -- Quests: the level tag from course-rep quests becomes a level audience; others are queued.
  insert into public.quest_audiences (quest_id, audience_kind, level_code)
  select q.id, 'level', q.level_code
  from public.quests q
  where q.level_code is not null
    and not exists (select 1 from public.quest_audiences x where x.quest_id = q.id);
  get diagnostics n = row_count; v_audiences := v_audiences + n;

  insert into public.migration_review_items (item_type, entity_id, details)
  select 'quest_audience', q.id, jsonb_build_object('title', q.title)
  from public.quests q
  where not exists (select 1 from public.quest_audiences x where x.quest_id = q.id)
  on conflict (item_type, entity_id) do nothing;
  get diagnostics n = row_count; v_items := v_items + n;

  insert into public.migration_review_items (item_type, entity_id, details)
  select 'profile_no_matric', p.id, jsonb_build_object('full_name', p.full_name)
  from public.profiles p
  where p.matric_number is null
  on conflict (item_type, entity_id) do nothing;
  get diagnostics n = row_count; v_items := v_items + n;

  return jsonb_build_object('placements', v_placements, 'audiences', v_audiences, 'lectures', v_lectures, 'review_items', v_items);
end;
$$;

revoke all on function public.run_legacy_backfill() from public, anon;
grant execute on function public.run_legacy_backfill() to authenticated, service_role;

-- Readable labels for the admin review screen.
create or replace view public.admin_migration_review
with (security_invoker = true) as
select
  r.id, r.item_type, r.entity_id, r.details, r.created_at,
  case r.item_type
    when 'announcement_level' then (select title from public.announcements where id = r.entity_id)
    when 'quest_audience' then (select title from public.quests where id = r.entity_id)
    when 'lecture_out_of_range' then (
      select c.course_code || ' · ' || to_char(l.lecture_date, 'DD Mon YYYY')
      from public.lecture_sessions l join public.courses c on c.id = l.course_id where l.id = r.entity_id)
    when 'placement' then (
      select p.full_name || ' · Level ' || sp.level_code
      from public.student_placements sp join public.profiles p on p.id = sp.student_id where sp.id = r.entity_id)
    when 'profile_no_matric' then (select full_name from public.profiles where id = r.entity_id)
    else null
  end as label
from public.migration_review_items r
where r.status = 'open';
grant select on public.admin_migration_review to authenticated;

select public.run_legacy_backfill();
