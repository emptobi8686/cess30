-- Migration 039: Private academic library (P8, department-expansion/04).
--
-- Metadata lives in library_* tables; who sees a resource is a set of audience rows (the
-- E4 model). Files sit in the private `library` bucket with NO storage policies for
-- clients: the server uploads through signed upload URLs, validates and finalises, and
-- serves reads through short-lived signed URLs after checking the user's RLS view.
--
-- Copyright and past-question rules follow the audit defaults (decision 0004 items 4-5,
-- PROVISIONAL until the department confirms): every resource records a copyright basis;
-- a past question must be `approved_past_question`, which only a department administrator
-- can set. Course representatives manage resources whose audiences are all in their level.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.library_tags_text(p_tags text[])
returns text language sql immutable set search_path = pg_catalog
as $$ select coalesce(array_to_string(p_tags, ' '), '') $$;

create table if not exists public.library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 200),
  description text check (description is null or length(description) <= 2000),
  resource_type text not null check (resource_type in ('lecture_slides', 'course_notes', 'pdf_document', 'presentation',
    'tutorial_sheet', 'lab_manual', 'reading_material', 'past_question', 'other')),
  course_id uuid references public.courses(id) on delete set null,
  offering_id uuid references public.course_offerings(id) on delete set null,
  level_code text references public.academic_levels(code),
  session_id uuid references public.academic_sessions(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived', 'removed')),
  current_file_id uuid,
  copyright_basis text not null check (copyright_basis in ('own_work', 'lecturer_permission', 'department_owned',
    'open_licence', 'public_domain', 'approved_past_question')),
  licence_note text check (licence_note is null or length(licence_note) <= 500),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
    || setweight(to_tsvector('english', public.library_tags_text(tags)), 'C')
  ) stored,
  created_by uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  archived_at timestamptz,
  removed_at timestamptz,
  removal_reason text check (removal_reason is null or length(trim(removal_reason)) between 8 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_past_question_approved check (resource_type <> 'past_question' or copyright_basis = 'approved_past_question')
);
create index if not exists library_resources_search_idx on public.library_resources using gin (search);
create index if not exists library_resources_title_trgm_idx on public.library_resources using gin (title extensions.gin_trgm_ops);
create index if not exists library_resources_status_idx on public.library_resources (status, published_at desc);

create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  version integer not null check (version >= 1),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 26214400),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  original_filename text not null check (length(original_filename) between 1 and 120),
  uploaded_by uuid not null references auth.users(id),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'rejected', 'not_scanned')),
  created_at timestamptz not null default now(),
  constraint library_files_version_unique unique (resource_id, version)
);

alter table public.library_resources drop constraint if exists library_resources_current_file_fkey;
alter table public.library_resources add constraint library_resources_current_file_fkey
  foreign key (current_file_id) references public.library_files(id) on delete set null;

create table if not exists public.library_resource_audiences (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  audience_kind text not null check (audience_kind in ('department', 'level', 'course', 'offering', 'staff_only')),
  department_id uuid references public.departments(id) on delete cascade,
  level_code text references public.academic_levels(code),
  course_id uuid references public.courses(id) on delete cascade,
  offering_id uuid references public.course_offerings(id) on delete cascade,
  session_id uuid references public.academic_sessions(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint library_resource_audiences_targets check (
    (audience_kind = 'department' and level_code is null and course_id is null and offering_id is null)
    or (audience_kind = 'level' and level_code is not null and course_id is null and offering_id is null)
    or (audience_kind = 'course' and course_id is not null and level_code is null and offering_id is null)
    or (audience_kind = 'offering' and offering_id is not null and level_code is null and course_id is null)
    or (audience_kind = 'staff_only' and department_id is null and level_code is null and course_id is null and offering_id is null)
  )
);
create index if not exists library_resource_audiences_owner_idx on public.library_resource_audiences (resource_id);

create table if not exists public.library_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.library_reports (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('broken', 'wrong_course', 'copyright', 'inappropriate', 'outdated', 'other')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or length(trim(resolution_note)) between 8 and 500),
  created_at timestamptz not null default now()
);
create unique index if not exists library_reports_one_open on public.library_reports (resource_id, reporter_id) where status = 'open';

create table if not exists public.library_access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  file_id uuid references public.library_files(id) on delete set null,
  mode text not null check (mode in ('download', 'preview')),
  at timestamptz not null default now()
);
create index if not exists library_access_log_resource_idx on public.library_access_log (resource_id, at desc);

drop trigger if exists set_library_resources_updated_at on public.library_resources;
create trigger set_library_resources_updated_at before update on public.library_resources
for each row execute function public.update_updated_at_column();

-- Rules ------------------------------------------------------------------------------------
create or replace function public.library_resource_rules()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.copyright_basis = 'approved_past_question'
     and (tg_op = 'INSERT' or old.copyright_basis is distinct from new.copyright_basis)
     and auth.uid() is not null
     and not public.has_capability('department_admin') then
    raise exception 'Only a department administrator can approve past questions.';
  end if;

  if new.current_file_id is not null and not exists (
    select 1 from public.library_files where id = new.current_file_id and resource_id = new.id
  ) then
    raise exception 'The file belongs to a different resource.';
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.current_file_id is null then raise exception 'Upload a file before publishing this resource.'; end if;
    if not exists (select 1 from public.library_resource_audiences where resource_id = new.id) then
      raise exception 'Choose who should see this resource before publishing it.';
    end if;
    new.published_by := coalesce(new.published_by, auth.uid());
    if new.published_by is null then raise exception 'A publisher is required.'; end if;
    new.published_at := coalesce(new.published_at, now());
    new.archived_at := null;
  end if;
  if new.status = 'archived' and (tg_op = 'INSERT' or old.status is distinct from 'archived') then
    new.archived_at := now();
  end if;
  if new.status = 'removed' and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    new.removed_at := coalesce(new.removed_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.library_resource_rules() from public, anon, authenticated;

drop trigger if exists library_resources_rules on public.library_resources;
create trigger library_resources_rules before insert or update on public.library_resources
for each row execute function public.library_resource_rules();

-- Access helpers -----------------------------------------------------------------------------
create or replace function public.can_view_library_resource(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.library_resources r
    where r.id = p_id and r.status = 'published'
      and (public.is_admin() or (
        public.my_verification_status() = 'verified'
        and exists (
          select 1 from public.library_resource_audiences a
          where a.resource_id = r.id
            and public.audience_matches(a.audience_kind, a.department_id, a.level_code, a.course_id, a.offering_id, a.session_id, a.semester_id))))
  );
$$;

create or replace function public.can_manage_library_resource(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or (
    public.holds_capability('level_coordinator')
    and exists (select 1 from public.library_resources where id = p_id)
    and not exists (
      select 1 from public.library_resource_audiences a
      where a.resource_id = p_id
        and not public.audience_row_allowed(a.audience_kind, a.level_code, a.course_id, a.offering_id))
    and (
      exists (select 1 from public.library_resource_audiences where resource_id = p_id)
      or exists (select 1 from public.library_resources where id = p_id and created_by = auth.uid())
    )
  );
$$;

create or replace function public.managed_library_resource_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$ select id from public.library_resources where public.can_manage_library_resource(id); $$;

-- Search runs with the caller's rights (RLS decides what is returned).
create or replace function public.search_library(
  p_query text, p_course_id uuid default null, p_level_code text default null, p_type text default null,
  p_semester_id uuid default null, p_limit integer default 20, p_offset integer default 0
)
returns setof public.library_resources
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with q as (
    select nullif(trim(coalesce(p_query, '')), '') as text
  )
  select r.*
  from public.library_resources r, q
  where r.status = 'published'
    and (p_course_id is null or r.course_id = p_course_id)
    and (p_level_code is null or r.level_code = p_level_code)
    and (p_type is null or r.resource_type = p_type)
    and (p_semester_id is null or r.semester_id = p_semester_id)
    and (
      q.text is null
      or (length(q.text) >= 3 and r.search @@ websearch_to_tsquery('english', q.text))
      or (length(q.text) < 3 and r.title ilike '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    )
  order by
    case when q.text is not null and length(q.text) >= 3 then ts_rank(r.search, websearch_to_tsquery('english', q.text)) else 0 end desc,
    r.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Audiences: one write path for announcements, quests and library resources.
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
  if p_table not in ('announcement_audiences', 'quest_audiences', 'library_resource_audiences') then
    raise exception 'Unknown audience table.';
  end if;
  if jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) > 20 then
    raise exception 'Give at most 20 audiences.';
  end if;
  if (p_table = 'announcement_audiences' and not public.can_manage_announcement(p_owner))
     or (p_table = 'quest_audiences' and not public.can_manage_quest(p_owner))
     or (p_table = 'library_resource_audiences' and not public.can_manage_library_resource(p_owner)) then
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
    select p_owner, r->>'audience_kind',
           case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  elsif p_table = 'quest_audiences' then
    delete from public.quest_audiences where quest_id = p_owner;
    insert into public.quest_audiences (quest_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind',
           case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  else
    delete from public.library_resource_audiences where resource_id = p_owner;
    insert into public.library_resource_audiences (resource_id, audience_kind, department_id, level_code, course_id, offering_id, session_id, semester_id, created_by)
    select p_owner, r->>'audience_kind',
           case when r->>'audience_kind' = 'department' then coalesce((r->>'department_id')::uuid, v_dept) end,
           r->>'level_code', (r->>'course_id')::uuid, (r->>'offering_id')::uuid, (r->>'session_id')::uuid, (r->>'semester_id')::uuid, auth.uid()
    from jsonb_array_elements(v_rows) r;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- RLS ------------------------------------------------------------------------------------------
alter table public.library_resources enable row level security;
alter table public.library_files enable row level security;
alter table public.library_resource_audiences enable row level security;
alter table public.library_bookmarks enable row level security;
alter table public.library_reports enable row level security;
alter table public.library_access_log enable row level security;

revoke all on public.library_resources, public.library_files, public.library_resource_audiences,
  public.library_bookmarks, public.library_reports, public.library_access_log from public, anon, authenticated;
grant select, insert, update, delete on public.library_resources to authenticated;
grant select on public.library_files, public.library_resource_audiences, public.library_access_log to authenticated;
grant select, insert, delete on public.library_bookmarks to authenticated;
grant select on public.library_reports to authenticated;
grant insert (resource_id, reporter_id, reason, details) on public.library_reports to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.library_reports to authenticated;
grant all on public.library_resources, public.library_files, public.library_resource_audiences,
  public.library_bookmarks, public.library_reports, public.library_access_log to service_role;

create policy "library_resources_select" on public.library_resources for select to authenticated
  using (public.can_view_library_resource(id) or public.can_manage_library_resource(id));
create policy "library_resources_insert" on public.library_resources for insert to authenticated
  with check (created_by = auth.uid() and public.holds_capability('level_coordinator'));
create policy "library_resources_update" on public.library_resources for update to authenticated
  using (public.can_manage_library_resource(id)) with check (public.can_manage_library_resource(id));
create policy "library_resources_delete" on public.library_resources for delete to authenticated
  using (public.is_admin());

create policy "library_files_select_staff" on public.library_files for select to authenticated
  using (public.can_manage_library_resource(resource_id));

create policy "library_resource_audiences_select" on public.library_resource_audiences for select to authenticated
  using (public.can_manage_library_resource(resource_id) or public.can_view_library_resource(resource_id));

create policy "library_bookmarks_select_own" on public.library_bookmarks for select to authenticated
  using (user_id = auth.uid());
create policy "library_bookmarks_insert_own" on public.library_bookmarks for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_library_resource(resource_id));
create policy "library_bookmarks_delete_own" on public.library_bookmarks for delete to authenticated
  using (user_id = auth.uid());

create policy "library_reports_select" on public.library_reports for select to authenticated
  using (reporter_id = auth.uid() or public.can_manage_library_resource(resource_id));
create policy "library_reports_insert_own" on public.library_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.can_view_library_resource(resource_id));
create policy "library_reports_resolve" on public.library_reports for update to authenticated
  using (public.can_manage_library_resource(resource_id)) with check (public.can_manage_library_resource(resource_id));

create policy "library_access_log_admin" on public.library_access_log for select to authenticated
  using (public.is_admin());

revoke all on function
  public.can_view_library_resource(uuid), public.can_manage_library_resource(uuid),
  public.managed_library_resource_ids(), public.search_library(text, uuid, text, text, uuid, integer, integer)
from public, anon;
grant execute on function
  public.can_view_library_resource(uuid), public.can_manage_library_resource(uuid),
  public.managed_library_resource_ids(), public.search_library(text, uuid, text, text, uuid, integer, integer)
to authenticated, service_role;

-- Private bucket; deliberately no storage.objects policies (service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png', 'image/jpeg', 'text/plain'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
