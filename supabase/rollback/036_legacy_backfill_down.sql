-- Reverse of 036_legacy_backfill.sql. Audience rows, lecture offering links and claimed
-- placements created by the backfill are left in place (they are additive and harmless
-- under the pre-036 policies); remove legacy_backfill placements explicitly if needed:
--   delete from public.student_placements where source = 'legacy_backfill' and status = 'claimed';
drop view if exists public.admin_migration_review;
drop function if exists public.run_legacy_backfill();
drop table if exists public.migration_review_items;
