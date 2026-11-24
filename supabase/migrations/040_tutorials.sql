-- Migration 040: Tutorials Pack (P9, department-expansion/05).
--
-- Curated video tutorials (YouTube, Vimeo, allow-listed sites) with audiences (E4 model),
-- saves, playlists, progress and reports. Only provider IDs are stored for embeds; the app
-- renders fixed embed templates. AI-generated content follows the audit defaults for
-- decision 0004 items 6-7 (PROVISIONAL): a different person must review it (a department
-- administrator, or the course representative for its level), the AI label is always
-- shown, any edit to a published AI tutorial sends it back to review, and two distinct
-- "inaccurate" reports hide it until re-reviewed.

create or replace function public.tutorial_objectives_text(p_items text[])
returns text language sql immutable set search_path = pg_catalog
as $$ select coalesce(array_to_string(p_items, ' '), '') $$;

create table if not exists public.tutorial_provider_domains (
  domain text primary key check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  provider text not null check (provider in ('youtube', 'vimeo', 'other_allowlisted')),
  embed_allowed boolean not null default false
);
insert into public.tutorial_provider_domains (domain, provider, embed_allowed) values
  ('youtube.com', 'youtube', true), ('youtu.be', 'youtube', true), ('vimeo.com', 'vimeo', true),
  ('ocw.mit.edu', 'other_allowlisted', false), ('khanacademy.org', 'other_allowlisted', false),
  ('nptel.ac.in', 'other_allowlisted', false)
on conflict (domain) do nothing;

create table if not exists public.tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 160),
  description text check (description is null or length(description) <= 2000),
  topic text not null check (length(trim(topic)) between 2 and 80),
  course_id uuid references public.courses(id) on delete set null,
  offering_id uuid references public.course_offerings(id) on delete set null,
  level_code text references public.academic_levels(code),
  semester_id uuid references public.semesters(id) on delete set null,
  source_type text not null check (source_type in ('youtube', 'ai_generated', 'external_platform', 'lecturer_recording', 'departmental')),
  provider text not null check (provider in ('youtube', 'vimeo', 'other_allowlisted')),
  provider_video_id text,
  external_url text not null check (external_url like 'https://%' and length(external_url) <= 500),
  embed_allowed boolean not null default true,
  creator_name text check (creator_name is null or length(creator_name) <= 120),
  provider_name text check (provider_name is null or length(provider_name) <= 120),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 36000),
  learning_objectives text[] not null default '{}' check (cardinality(learning_objectives) <= 8),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived', 'removed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'changes_requested', 'rejected')),
  is_ai_generated boolean not null default false,
  ai_tool text check (ai_tool is null or length(ai_tool) <= 120),
  ai_disclosure text check (ai_disclosure is null or length(ai_disclosure) <= 1000),
  academic_reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or length(review_notes) <= 1000),
  link_status text not null default 'unchecked' check (link_status in ('ok', 'broken', 'unavailable_embed', 'unchecked')),
  last_link_check_at timestamptz,
  created_by uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  removed_at timestamptz,
  removal_reason text check (removal_reason is null or length(trim(removal_reason)) between 8 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(topic, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
    || setweight(to_tsvector('english', public.tutorial_objectives_text(learning_objectives)), 'C')
  ) stored,
  constraint tutorials_provider_ids check (
    (provider = 'youtube' and provider_video_id ~ '^[A-Za-z0-9_-]{11}$')
    or (provider = 'vimeo' and provider_video_id ~ '^\d{6,12}$')
    or (provider = 'other_allowlisted' and provider_video_id is null)
  ),
  constraint tutorials_ai_fields check (not is_ai_generated or (ai_tool is not null and length(trim(coalesce(ai_disclosure, ''))) > 0))
);
create index if not exists tutorials_search_idx on public.tutorials using gin (search);
create index if not exists tutorials_status_idx on public.tutorials (status, published_at desc);

create table if not exists public.tutorial_audiences (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  audience_kind text not null check (audience_kind in ('department', 'level', 'course', 'offering', 'staff_only')),
  department_id uuid references public.departments(id) on delete cascade,
  level_code text references public.academic_levels(code),
  course_id uuid references public.courses(id) on delete cascade,
  offering_id uuid references public.course_offerings(id) on delete cascade,
  session_id uuid references public.academic_sessions(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tutorial_audiences_targets check (
    (audience_kind = 'department' and level_code is null and course_id is null and offering_id is null)
    or (audience_kind = 'level' and level_code is not null and course_id is null and offering_id is null)
    or (audience_kind = 'course' and course_id is not null and level_code is null and offering_id is null)
    or (audience_kind = 'offering' and offering_id is not null and level_code is null and course_id is null)
    or (audience_kind = 'staff_only' and department_id is null and level_code is null and course_id is null and offering_id is null)
  )
);
create index if not exists tutorial_audiences_owner_idx on public.tutorial_audiences (tutorial_id);

create table if not exists public.tutorial_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  description text check (description is null or length(description) <= 500),
  is_official boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint tutorial_playlists_owner check ((is_official and owner_id is null) or (not is_official and owner_id is not null))
);

create table if not exists public.tutorial_playlist_items (
  playlist_id uuid not null references public.tutorial_playlists(id) on delete cascade,
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  position integer not null check (position >= 1),
  primary key (playlist_id, tutorial_id),
  constraint tutorial_playlist_items_position unique (playlist_id, position)
);

create table if not exists public.tutorial_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.tutorial_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  percent_watched numeric(5, 2) not null default 0 check (percent_watched between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.tutorial_reports (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('broken_link', 'not_embeddable', 'inaccurate', 'inappropriate', 'copyright', 'other')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or length(trim(resolution_note)) between 8 and 500),
  created_at timestamptz not null default now()
);
create unique index if not exists tutorial_reports_one_open on public.tutorial_reports (tutorial_id, reporter_id) where status = 'open';

create table if not exists public.tutorial_review_events (
  id bigint generated always as identity primary key,
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'changes_requested', 'rejected', 'reset_on_edit', 'auto_hidden')),
  actor uuid references auth.users(id),
  notes text,
  at timestamptz not null default now()
);

drop trigger if exists set_tutorials_updated_at on public.tutorials;
create trigger set_tutorials_updated_at before update on public.tutorials
for each row execute function public.update_updated_at_column();

-- Helpers ------------------------------------------------------------------------------------
create or replace function public.can_manage_tutorial(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or (
    public.holds_capability('level_coordinator')
    and exists (select 1 from public.tutorials where id = p_id)
    and not exists (
      select 1 from public.tutorial_audiences a
      where a.tutorial_id = p_id and not public.audience_row_allowed(a.audience_kind, a.level_code, a.course_id, a.offering_id))
    and (
      exists (select 1 from public.tutorial_audiences where tutorial_id = p_id)
      or exists (select 1 from public.tutorials where id = p_id and created_by = auth.uid())
    )
  );
$$;

create or replace function public.can_view_tutorial(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.tutorials t
    where t.id = p_id and t.status = 'published'
      and (public.is_admin() or (
        public.my_verification_status() = 'verified'
        and exists (
          select 1 from public.tutorial_audiences a
          where a.tutorial_id = t.id
            and public.audience_matches(a.audience_kind, a.department_id, a.level_code, a.course_id, a.offering_id, a.session_id, a.semester_id))))
  );
$$;

-- A reviewer may approve: a department administrator, or the course representative for the
-- tutorial's level/course/offering scope. Never the creator.
create or replace function public.tutorial_reviewer_allowed(p_reviewer uuid, p_tutorial public.tutorials)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_reviewer is not null
     and p_reviewer <> p_tutorial.created_by
     and (public.user_has_capability(p_reviewer, 'department_admin')
          or ((p_tutorial.level_code is not null or p_tutorial.course_id is not null or p_tutorial.offering_id is not null)
              and public.user_has_capability(p_reviewer, 'level_coordinator', p_tutorial.level_code, p_tutorial.course_id, p_tutorial.offering_id)));
$$;

create or replace function public.tutorials_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Re-review on change: editing a published AI tutorial unpublishes it.
  if tg_op = 'UPDATE' and old.status = 'published' and new.is_ai_generated
     and (new.title is distinct from old.title or new.description is distinct from old.description
          or new.learning_objectives is distinct from old.learning_objectives
          or new.external_url is distinct from old.external_url or new.provider_video_id is distinct from old.provider_video_id) then
    new.status := 'in_review';
    new.review_status := 'pending';
    new.academic_reviewer_id := null;
    new.reviewed_at := null;
    insert into public.tutorial_review_events (tutorial_id, action, actor, notes)
    values (new.id, 'reset_on_edit', auth.uid(), 'Edited after publication; needs a new review.');
    return new;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.review_status <> 'approved' then
      raise exception 'This tutorial must be reviewed and approved before publishing.';
    end if;
    if not exists (select 1 from public.tutorial_audiences where tutorial_id = new.id) then
      raise exception 'Choose who should see this tutorial before publishing it.';
    end if;
    if new.is_ai_generated and not public.tutorial_reviewer_allowed(new.academic_reviewer_id, new) then
      raise exception 'AI-generated tutorials need an approval from a different, authorised reviewer.';
    end if;
    new.published_by := coalesce(new.published_by, auth.uid());
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status = 'removed' and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    new.removed_at := coalesce(new.removed_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.tutorials_publication_gate() from public, anon, authenticated;
drop trigger if exists tutorials_publication_gate on public.tutorials;
create trigger tutorials_publication_gate before insert or update on public.tutorials
for each row execute function public.tutorials_publication_gate();

-- Review is an RPC so the review columns can never be written directly by clients.
create or replace function public.review_tutorial(p_id uuid, p_decision text, p_notes text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_t public.tutorials%rowtype;
begin
  if v_uid is null then raise exception 'Authenticated session required.'; end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then raise exception 'Choose a review decision.'; end if;
  if length(trim(coalesce(p_notes, ''))) < 8 then raise exception 'Add review notes of at least 8 characters.'; end if;
  select * into v_t from public.tutorials where id = p_id for update;
  if not found then raise exception 'Tutorial not found.'; end if;
  if v_t.created_by = v_uid then raise exception 'You cannot review your own content.'; end if;
  if not public.tutorial_reviewer_allowed(v_uid, v_t) then raise exception 'You cannot review this tutorial.'; end if;

  update public.tutorials
  set review_status = p_decision,
      academic_reviewer_id = v_uid,
      reviewed_at = now(),
      review_notes = trim(p_notes),
      status = case when p_decision = 'approved' then status when status = 'published' then 'in_review' else status end
  where id = p_id;
  insert into public.tutorial_review_events (tutorial_id, action, actor, notes) values (p_id, p_decision, v_uid, trim(p_notes));
end;
$$;

create or replace function public.managed_tutorial_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$ select id from public.tutorials where public.can_manage_tutorial(id); $$;

create or replace function public.search_tutorials(
  p_query text, p_course_id uuid default null, p_level_code text default null, p_source_type text default null,
  p_topic text default null, p_limit integer default 30, p_offset integer default 0
)
returns setof public.tutorials
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with q as (select nullif(trim(coalesce(p_query, '')), '') as text)
  select t.*
  from public.tutorials t, q
  where t.status = 'published'
    and (p_course_id is null or t.course_id = p_course_id)
    and (p_level_code is null or t.level_code = p_level_code)
    and (p_source_type is null or t.source_type = p_source_type)
    and (p_topic is null or t.topic ilike replace(replace(replace(p_topic, '\', '\\'), '%', '\%'), '_', '\_'))
    and (
      q.text is null
      or (length(q.text) >= 3 and t.search @@ websearch_to_tsquery('english', q.text))
      or (length(q.text) < 3 and t.title ilike '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    )
  order by
    case when q.text is not null and length(q.text) >= 3 then ts_rank(t.search, websearch_to_tsquery('english', q.text)) else 0 end desc,
    t.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Two distinct open "inaccurate" reports hide a published AI tutorial for re-review.
create or replace function public.tutorial_reports_autohide()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.reason = 'inaccurate'
     and exists (select 1 from public.tutorials where id = new.tutorial_id and is_ai_generated and status = 'published')
     and (select count(distinct reporter_id) from public.tutorial_reports
          where tutorial_id = new.tutorial_id and reason = 'inaccurate' and status = 'open') >= 2 then
    update public.tutorials set status = 'in_review', review_status = 'pending', academic_reviewer_id = null, reviewed_at = null
    where id = new.tutorial_id;
    insert into public.tutorial_review_events (tutorial_id, action, notes)
    values (new.tutorial_id, 'auto_hidden', 'Hidden after two inaccuracy reports.');
  end if;
  return new;
end;
$$;
revoke all on function public.tutorial_reports_autohide() from public, anon, authenticated;
drop trigger if exists tutorial_reports_autohide on public.tutorial_reports;
create trigger tutorial_reports_autohide after insert on public.tutorial_reports
for each row execute function public.tutorial_reports_autohide();

-- replace_audiences: add tutorials (announcements, quests, library, tutorials).
create or replace function public.replace_audiences(p_table text, p_owner uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
  v_dept uuid;
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
begin
  if p_table not in ('announcement_audiences', 'quest_audiences', 'library_resource_audiences', 'tutorial_audiences') then
    raise exception 'Unknown audience table.';
  end if;
  if jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) > 20 then
    raise exception 'Give at most 20 audiences.';
  end if;
  if (p_table = 'announcement_audiences' and not public.can_manage_announcement(p_owner))
     or (p_table = 'quest_audiences' and not public.can_manage_quest(p_owner))
     or (p_table = 'library_resource_audiences' and not public.can_manage_library_resource(p_owner))
     or (p_table = 'tutorial_audiences' and not public.can_manage_tutorial(p_owner)) then
    raise exception 'You cannot change who sees this.';
  end if;

  for v_row in select * from jsonb_array_elements(v_rows) loop
    if not public.audience_row_allowed(v_row->>'audience_kind', v_row->>'level_code', (v_row->>'course_id')::uuid, (v_row->>'offering_id')::uuid) then
      raise exception 'You cannot target that audience.';
    end if;
  end loop;

  select id into v_dept from public.departments where code = 'CVE';

  if p_table = 'announcement_audiences' then
    delete from public.announcement_audiences where announcement_id = p_owner;
    insert into public.announcement_audiences (announcement_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind', case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  elsif p_table = 'quest_audiences' then
    delete from public.quest_audiences where quest_id = p_owner;
    insert into public.quest_audiences (quest_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind', case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  elsif p_table = 'library_resource_audiences' then
    delete from public.library_resource_audiences where resource_id = p_owner;
    insert into public.library_resource_audiences (resource_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind', case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  else
    delete from public.tutorial_audiences where tutorial_id = p_owner;
    insert into public.tutorial_audiences (tutorial_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind', case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- RLS ------------------------------------------------------------------------------------------
alter table public.tutorial_provider_domains enable row level security;
alter table public.tutorials enable row level security;
alter table public.tutorial_audiences enable row level security;
alter table public.tutorial_playlists enable row level security;
alter table public.tutorial_playlist_items enable row level security;
alter table public.tutorial_saves enable row level security;
alter table public.tutorial_progress enable row level security;
alter table public.tutorial_reports enable row level security;
alter table public.tutorial_review_events enable row level security;

revoke all on public.tutorial_provider_domains, public.tutorials, public.tutorial_audiences, public.tutorial_playlists,
  public.tutorial_playlist_items, public.tutorial_saves, public.tutorial_progress, public.tutorial_reports,
  public.tutorial_review_events from public, anon, authenticated;
grant select on public.tutorial_provider_domains, public.tutorials, public.tutorial_audiences, public.tutorial_review_events to authenticated;
grant insert, update, delete on public.tutorial_provider_domains to authenticated;
-- Review, publication-audit and link-health columns are not client-writable.
grant insert (id, title, description, topic, course_id, offering_id, level_code, semester_id, source_type, provider, provider_video_id,
  external_url, embed_allowed, creator_name, provider_name, duration_seconds, learning_objectives, status, is_ai_generated,
  ai_tool, ai_disclosure, created_by) on public.tutorials to authenticated;
grant update (title, description, topic, course_id, offering_id, level_code, semester_id, source_type, provider, provider_video_id,
  external_url, embed_allowed, creator_name, provider_name, duration_seconds, learning_objectives, status, is_ai_generated,
  ai_tool, ai_disclosure, removal_reason) on public.tutorials to authenticated;
grant delete on public.tutorials to authenticated;
grant select, insert, update, delete on public.tutorial_playlists, public.tutorial_playlist_items to authenticated;
grant select, insert, delete on public.tutorial_saves to authenticated;
grant select, insert, update on public.tutorial_progress to authenticated;
grant select on public.tutorial_reports to authenticated;
grant insert (tutorial_id, reporter_id, reason, details) on public.tutorial_reports to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.tutorial_reports to authenticated;
grant all on public.tutorial_provider_domains, public.tutorials, public.tutorial_audiences, public.tutorial_playlists,
  public.tutorial_playlist_items, public.tutorial_saves, public.tutorial_progress, public.tutorial_reports,
  public.tutorial_review_events to service_role;

create policy "tutorial_provider_domains_select" on public.tutorial_provider_domains for select to authenticated using (true);
create policy "tutorial_provider_domains_admin" on public.tutorial_provider_domains for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "tutorials_select" on public.tutorials for select to authenticated
  using (public.can_view_tutorial(id) or public.can_manage_tutorial(id));
create policy "tutorials_insert" on public.tutorials for insert to authenticated
  with check (created_by = auth.uid() and public.holds_capability('level_coordinator') and status in ('draft', 'in_review'));
create policy "tutorials_update" on public.tutorials for update to authenticated
  using (public.can_manage_tutorial(id)) with check (public.can_manage_tutorial(id));
create policy "tutorials_delete" on public.tutorials for delete to authenticated using (public.is_admin());

create policy "tutorial_audiences_select" on public.tutorial_audiences for select to authenticated
  using (public.can_manage_tutorial(tutorial_id) or public.can_view_tutorial(tutorial_id));
create policy "tutorial_review_events_select" on public.tutorial_review_events for select to authenticated
  using (public.can_manage_tutorial(tutorial_id));

-- Personal playlists are private to their owner; official playlists are readable by verified
-- students (their items still pass through tutorial RLS) and written by staff.
create policy "tutorial_playlists_select" on public.tutorial_playlists for select to authenticated
  using (owner_id = auth.uid() or (is_official and status = 'active' and (public.is_verified_student() or public.holds_capability('level_coordinator'))));
create policy "tutorial_playlists_write_own" on public.tutorial_playlists for all to authenticated
  using (owner_id = auth.uid() and not is_official) with check (owner_id = auth.uid() and not is_official);
create policy "tutorial_playlists_write_official" on public.tutorial_playlists for all to authenticated
  using (is_official and public.holds_capability('level_coordinator')) with check (is_official and owner_id is null and public.holds_capability('level_coordinator'));

create policy "tutorial_playlist_items_select" on public.tutorial_playlist_items for select to authenticated
  using (exists (select 1 from public.tutorial_playlists p where p.id = playlist_id
                 and (p.owner_id = auth.uid() or (p.is_official and p.status = 'active'))) and public.can_view_tutorial(tutorial_id)
         or public.can_manage_tutorial(tutorial_id));
create policy "tutorial_playlist_items_write" on public.tutorial_playlist_items for all to authenticated
  using (exists (select 1 from public.tutorial_playlists p where p.id = playlist_id
                 and ((p.owner_id = auth.uid() and not p.is_official) or (p.is_official and public.holds_capability('level_coordinator')))))
  with check (exists (select 1 from public.tutorial_playlists p where p.id = playlist_id
                 and ((p.owner_id = auth.uid() and not p.is_official) or (p.is_official and public.holds_capability('level_coordinator'))))
              and (public.can_view_tutorial(tutorial_id) or public.can_manage_tutorial(tutorial_id)));

create policy "tutorial_saves_own_select" on public.tutorial_saves for select to authenticated using (user_id = auth.uid());
create policy "tutorial_saves_own_insert" on public.tutorial_saves for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_tutorial(tutorial_id));
create policy "tutorial_saves_own_delete" on public.tutorial_saves for delete to authenticated using (user_id = auth.uid());

create policy "tutorial_progress_own_select" on public.tutorial_progress for select to authenticated using (user_id = auth.uid());
create policy "tutorial_progress_own_insert" on public.tutorial_progress for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_tutorial(tutorial_id));
create policy "tutorial_progress_own_update" on public.tutorial_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tutorial_reports_select" on public.tutorial_reports for select to authenticated
  using (reporter_id = auth.uid() or public.can_manage_tutorial(tutorial_id));
create policy "tutorial_reports_insert_own" on public.tutorial_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.can_view_tutorial(tutorial_id));
create policy "tutorial_reports_resolve" on public.tutorial_reports for update to authenticated
  using (public.can_manage_tutorial(tutorial_id)) with check (public.can_manage_tutorial(tutorial_id));

revoke all on function
  public.can_manage_tutorial(uuid), public.can_view_tutorial(uuid), public.tutorial_reviewer_allowed(uuid, public.tutorials),
  public.review_tutorial(uuid, text, text), public.managed_tutorial_ids(),
  public.search_tutorials(text, uuid, text, text, text, integer, integer)
from public, anon;
grant execute on function
  public.can_manage_tutorial(uuid), public.can_view_tutorial(uuid),
  public.review_tutorial(uuid, text, text), public.managed_tutorial_ids(),
  public.search_tutorials(text, uuid, text, text, text, integer, integer)
to authenticated, service_role;
revoke all on function public.tutorial_reviewer_allowed(uuid, public.tutorials) from authenticated;
