-- Migration 043: students can upload a file (photo or PDF) as quest evidence.
--
-- A submission now carries either an https link (evidence_url) or a file in the private
-- quest-evidence bucket (evidence_path), or both. The path is chosen by the server as
-- "<student id>/<random id>.<ext>"; the insert policy also refuses a path outside the
-- student's own folder. Reviewers open files through the app, which signs a short-lived
-- link after checking they can see the submission.

alter table public.quest_submissions alter column evidence_url drop not null;
alter table public.quest_submissions add column if not exists evidence_path text;

alter table public.quest_submissions drop constraint if exists quest_submissions_evidence_path_format;
alter table public.quest_submissions add constraint quest_submissions_evidence_path_format
  check (evidence_path is null
         or evidence_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$');

alter table public.quest_submissions drop constraint if exists quest_submissions_evidence_present;
alter table public.quest_submissions add constraint quest_submissions_evidence_present
  check (evidence_url is not null or evidence_path is not null);

comment on column public.quest_submissions.evidence_path is
  'Object path of uploaded evidence in the private quest-evidence bucket (<student id>/<id>.<ext>).';

grant insert (evidence_path) on public.quest_submissions to authenticated;

drop policy if exists "quest_submissions_insert_own" on public.quest_submissions;
create policy "quest_submissions_insert_own" on public.quest_submissions for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and (evidence_path is null or split_part(evidence_path, '/', 1) = auth.uid()::text)
    and public.quest_is_open(quest_id)
    and public.is_verified_student()
    and public.can_view_quest(quest_id)
  );

-- Uploads land only in the student's own folder; photos and PDFs only.
drop policy if exists "quest_evidence_insert_own" on storage.objects;
create policy "quest_evidence_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quest-evidence'
    and owner = auth.uid()
    and split_part(name, '/', 1) = auth.uid()::text
  );

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 10485760
where id = 'quest-evidence';
