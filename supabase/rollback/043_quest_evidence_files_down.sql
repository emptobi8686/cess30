-- Rollback 043. Submissions that only have a file must be removed or given a link first,
-- or restoring NOT NULL on evidence_url fails.
alter table public.quest_submissions drop constraint if exists quest_submissions_evidence_present;
alter table public.quest_submissions drop constraint if exists quest_submissions_evidence_path_format;
revoke insert (evidence_path) on public.quest_submissions from authenticated;
alter table public.quest_submissions drop column if exists evidence_path;
alter table public.quest_submissions alter column evidence_url set not null;
-- Re-run the quest_submissions_insert_own policy from 037 and quest_evidence_insert_own from 019.
