-- Reverse of 040_tutorials.sql. Afterwards re-run the replace_audiences definition from
-- 039_library.sql (announcements, quests and library only).
drop trigger if exists tutorial_reports_autohide on public.tutorial_reports;
drop function if exists public.tutorial_reports_autohide();
drop function if exists public.search_tutorials(text, uuid, text, text, text, integer, integer);
drop function if exists public.managed_tutorial_ids();
drop function if exists public.review_tutorial(uuid, text, text);
drop table if exists public.tutorial_review_events;
drop table if exists public.tutorial_reports;
drop table if exists public.tutorial_progress;
drop table if exists public.tutorial_saves;
drop table if exists public.tutorial_playlist_items;
drop table if exists public.tutorial_playlists;
drop table if exists public.tutorial_audiences;
drop trigger if exists tutorials_publication_gate on public.tutorials;
drop function if exists public.tutorials_publication_gate();
drop function if exists public.tutorial_reviewer_allowed(uuid, public.tutorials);
drop function if exists public.can_view_tutorial(uuid);
drop function if exists public.can_manage_tutorial(uuid);
drop table if exists public.tutorials;
drop table if exists public.tutorial_provider_domains;
drop function if exists public.tutorial_objectives_text(text[]);
