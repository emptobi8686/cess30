-- Migration 029: Announcement length limits (audit finding BP-050).
-- Pre-check existing rows so the migration fails with a clear list instead of a
-- generic constraint error; constraints are added NOT VALID, then validated.

do $$
declare
  v_offenders text;
begin
  select string_agg(id::text, ', ')
  into v_offenders
  from public.announcements
  where length(title) not between 1 and 160
     or length(content) not between 1 and 5000;

  if v_offenders is not null then
    raise exception 'Announcements exceed the new length limits; shorten them first: %', v_offenders;
  end if;
end;
$$;

alter table public.announcements
  add constraint announcements_title_length check (length(title) between 1 and 160) not valid;
alter table public.announcements
  add constraint announcements_content_length check (length(content) between 1 and 5000) not valid;

alter table public.announcements validate constraint announcements_title_length;
alter table public.announcements validate constraint announcements_content_length;
