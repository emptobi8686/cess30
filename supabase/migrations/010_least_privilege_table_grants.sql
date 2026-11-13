revoke all on table
  public.profiles,
  public.courses,
  public.user_roles,
  public.lecture_sessions,
  public.study_sessions,
  public.announcements
from public, anon, authenticated;

grant select on table
  public.profiles,
  public.courses,
  public.user_roles,
  public.lecture_sessions,
  public.announcements
to authenticated;

grant select, insert, update, delete on table public.study_sessions
to authenticated;

grant insert, update, delete on table
  public.courses,
  public.lecture_sessions,
  public.announcements
to authenticated;
