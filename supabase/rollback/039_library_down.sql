-- Reverse of 039_library.sql. Storage objects in the `library` bucket must be deleted
-- first (Dashboard → Storage, or the service role); the bucket row is removed last.
-- replace_audiences is restored to the 035 version (announcements and quests only).
drop function if exists public.search_library(text, uuid, text, text, uuid, integer, integer);
drop function if exists public.managed_library_resource_ids();
drop table if exists public.library_access_log;
drop table if exists public.library_reports;
drop table if exists public.library_bookmarks;
drop table if exists public.library_resource_audiences;
alter table if exists public.library_resources drop constraint if exists library_resources_current_file_fkey;
drop table if exists public.library_files;
drop table if exists public.library_resources;
drop function if exists public.can_manage_library_resource(uuid);
drop function if exists public.can_view_library_resource(uuid);
drop function if exists public.library_resource_rules();
drop function if exists public.library_tags_text(text[]);
delete from storage.buckets where id = 'library';
-- Re-run the replace_audiences definition from 035_content_audiences.sql afterwards.
