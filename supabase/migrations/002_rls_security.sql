create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.matric_number is distinct from old.matric_number
     or new.department is distinct from old.department
     or new.level is distinct from old.level
     or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity and protected fields are read-only for students.';
  end if;

  return new;
end;
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.user_roles enable row level security;
alter table public.lecture_sessions enable row level security;
alter table public.study_sessions enable row level security;
alter table public.announcements enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create trigger profiles_protect_identity_fields
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();

create policy "courses_select_authenticated"
on public.courses
for select
using (auth.role() = 'authenticated');

create policy "courses_manage_admin_only"
on public.courses
for all
using (public.is_admin())
with check (public.is_admin());

create policy "user_roles_select_self_or_admin"
on public.user_roles
for select
using (auth.uid() = user_id or public.is_admin());

create policy "user_roles_insert_admin_only"
on public.user_roles
for insert
with check (public.is_admin() and assigned_by = auth.uid());

create policy "user_roles_update_admin_only"
on public.user_roles
for update
using (public.is_admin())
with check (public.is_admin() and assigned_by = auth.uid());

create policy "user_roles_delete_admin_only"
on public.user_roles
for delete
using (public.is_admin());

create policy "lecture_sessions_select_authenticated"
on public.lecture_sessions
for select
using (auth.role() = 'authenticated');

create policy "lecture_sessions_manage_admin_only"
on public.lecture_sessions
for all
using (public.is_admin())
with check (public.is_admin() and created_by = auth.uid());

create policy "study_sessions_select_own"
on public.study_sessions
for select
using (auth.uid() = user_id);

create policy "study_sessions_manage_own"
on public.study_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "announcements_select_authenticated"
on public.announcements
for select
using (
  auth.role() = 'authenticated'
  and published_at <= now()
);

create policy "announcements_manage_admin_only"
on public.announcements
for all
using (public.is_admin())
with check (public.is_admin() and created_by = auth.uid());

create or replace function public.validate_announcement_scope()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.scope = 'course' and new.course_id is null then
    raise exception 'course announcements require a course_id';
  end if;

  if new.scope <> 'course' and new.course_id is not null then
    raise exception 'only course-scoped announcements may reference a course_id';
  end if;

  return new;
end;
$$;

create trigger announcements_scope_guard
before insert or update on public.announcements
for each row
execute function public.validate_announcement_scope();

create index if not exists idx_user_roles_user_role on public.user_roles(user_id, role);
create index if not exists idx_course_announcements_scope on public.announcements(scope, published_at desc);

grant usage on schema public to authenticated;
grant select on public.courses to authenticated;
grant select on public.lecture_sessions to authenticated;
grant select on public.announcements to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
