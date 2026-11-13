-- Phase 6: in-app notifications, push subscriptions, preferences, and delivery state.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  message text not null check (length(message) between 1 and 500),
  notification_type text not null
    check (notification_type in ('lecture_reminder', 'study_reminder', 'announcement', 'system')),
  source_type text not null
    check (source_type in ('lecture', 'study_session', 'announcement', 'system')),
  source_id uuid,
  action_url text
    check (
      action_url is null
      or (
        left(action_url, 1) = '/'
        and left(action_url, 2) not in ('//', '/' || chr(92))
      )
    ),
  dedupe_key text not null unique,
  is_read boolean not null default false,
  read_at timestamptz,
  push_requested boolean not null default false,
  push_status text not null default 'not_requested'
    check (push_status in ('not_requested', 'pending', 'sending', 'sent', 'failed', 'disabled')),
  push_attempt_count smallint not null default 0 check (push_attempt_count between 0 and 4),
  push_started_at timestamptz,
  push_sent_at timestamptz,
  push_expires_at timestamptz,
  push_error_code text,
  created_at timestamptz not null default now(),
  constraint notifications_read_state_check
    check ((is_read and read_at is not null) or (not is_read and read_at is null)),
  constraint notifications_push_request_state_check
    check (push_requested or push_status = 'not_requested')
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  device_label text not null default 'This device'
    check (length(device_label) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  lecture_reminders_enabled boolean not null default true,
  study_reminders_enabled boolean not null default true,
  announcement_notifications_enabled boolean not null default true,
  lecture_reminder_minutes smallint not null default 30
    check (lecture_reminder_minutes in (15, 30, 60)),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_quiet_hours_check
    check (not quiet_hours_enabled or quiet_hours_start <> quiet_hours_end)
);

create index notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where is_read = false;
create index notifications_push_pending_idx
  on public.notifications(created_at)
  where push_status in ('pending', 'failed', 'sending');
create index push_subscriptions_user_idx
  on public.push_subscriptions(user_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on public.notifications from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;

grant select, delete on public.notifications to authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;
grant select on public.notification_preferences to authenticated;
grant all on public.notifications, public.push_subscriptions, public.notification_preferences to service_role;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "notifications_update_read_state_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.create_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_default_notification_preferences() from public, anon, authenticated;

create trigger create_profile_notification_preferences
after insert on public.profiles
for each row
execute function public.create_default_notification_preferences();

insert into public.notification_preferences(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.update_updated_at_column();

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.update_updated_at_column();

create or replace function public.claim_pending_notification_pushes(batch_size integer default 100)
returns setof public.notifications
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select id
    from public.notifications
    where push_requested
      and push_attempt_count < 4
      and (push_expires_at is null or push_expires_at > now())
      and not exists (
        select 1
        from public.notification_preferences as preferences
        where preferences.user_id = notifications.user_id
          and preferences.quiet_hours_enabled
          and (
            (
              preferences.quiet_hours_start < preferences.quiet_hours_end
              and (now() at time zone 'Africa/Lagos')::time >= preferences.quiet_hours_start
              and (now() at time zone 'Africa/Lagos')::time < preferences.quiet_hours_end
            )
            or (
              preferences.quiet_hours_start > preferences.quiet_hours_end
              and (
                (now() at time zone 'Africa/Lagos')::time >= preferences.quiet_hours_start
                or (now() at time zone 'Africa/Lagos')::time < preferences.quiet_hours_end
              )
            )
          )
      )
      and (
        push_status = 'pending'
        or (
          push_status in ('sending', 'failed')
          and push_started_at < now() - interval '5 minutes'
        )
      )
    order by created_at
    limit least(greatest(batch_size, 1), 250)
    for update skip locked
  ),
  claimed as (
    update public.notifications as n
    set push_status = 'sending',
        push_started_at = now(),
        push_attempt_count = n.push_attempt_count + 1,
        push_error_code = null
    from candidates
    where n.id = candidates.id
    returning n.*
  )
  select * from claimed;
$$;

revoke all on function public.claim_pending_notification_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_notification_pushes(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
