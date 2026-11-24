-- P8 library: schema, private bucket, audience visibility, publish rules, search, takedown.
begin;
\ir _helpers.psql
select plan(24);

select tests.create_user('lib-admin@test.local', '{"full_name":"Admin","matric_number":"992000001"}') as adm \gset
select tests.create_user('lib-rep@test.local', '{"full_name":"Rep","matric_number":"992000002"}') as rep \gset
select tests.create_user('lib-s200@test.local', '{"full_name":"Two","matric_number":"992000003"}') as s200 \gset
select tests.create_user('lib-s300@test.local', '{"full_name":"Three","matric_number":"992000004"}') as s300 \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'adm', 'verified');
select tests.set_verification(:'rep', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'s300', 'verified');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e500', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'s200', '00000000-0000-0000-0000-00000000e500', '200', 'confirmed'),
  (:'s300', '00000000-0000-0000-0000-00000000e500', '300', 'confirmed');

-- Fixtures as postgres: a published level-200 resource, a draft, a level-300 one.
insert into public.library_resources (id, title, description, resource_type, level_code, copyright_basis, created_by) values
  ('00000000-0000-0000-0000-00000000c501', 'Beam Theory Notes', 'Bending of simply supported beams.', 'course_notes', '200', 'own_work', :'adm'),
  ('00000000-0000-0000-0000-00000000c502', 'Beam draft', 'Unfinished beam notes.', 'course_notes', '200', 'own_work', :'adm'),
  ('00000000-0000-0000-0000-00000000c503', 'Beam design 300', 'Level 300 beam design.', 'course_notes', '300', 'own_work', :'adm');
insert into public.library_files (id, resource_id, version, storage_path, mime_type, size_bytes, original_filename, uploaded_by, scan_status) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000c501', 1, 'resources/00000000-0000-0000-0000-00000000c501/00000000-0000-0000-0000-00000000f501.pdf', 'application/pdf', 1000, 'beams.pdf', :'adm', 'not_scanned'),
  ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-00000000c503', 1, 'resources/00000000-0000-0000-0000-00000000c503/00000000-0000-0000-0000-00000000f503.pdf', 'application/pdf', 1000, 'b300.pdf', :'adm', 'not_scanned');
insert into public.library_resource_audiences (resource_id, audience_kind, level_code) values
  ('00000000-0000-0000-0000-00000000c501', 'level', '200'),
  ('00000000-0000-0000-0000-00000000c502', 'level', '200'),
  ('00000000-0000-0000-0000-00000000c503', 'level', '300');
update public.library_resources set current_file_id = '00000000-0000-0000-0000-00000000f501', status = 'published', published_by = :'adm'
  where id = '00000000-0000-0000-0000-00000000c501';
update public.library_resources set current_file_id = '00000000-0000-0000-0000-00000000f503', status = 'published', published_by = :'adm'
  where id = '00000000-0000-0000-0000-00000000c503';

-- Storage: private bucket, no client policies.
select is((select public from storage.buckets where id = 'library'), false, 'library bucket is private');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and (coalesce(qual, '') ilike '%library%' or coalesce(with_check, '') ilike '%library%')), 0, 'no storage policies touch the library bucket');

-- Visibility.
select tests.authenticate_as(:'s200');
select is((select array_agg(title order by title) from public.library_resources), array['Beam Theory Notes'], 'level-200 student sees only the published level-200 resource');
select is((select count(*)::int from public.library_files), 0, 'students never read file rows (paths)');
select is((select array_agg(title) from public.search_library('beam')), array['Beam Theory Notes'], 'search returns only visible rows');
select lives_ok($$select * from public.search_library('"; drop table x; --')$$, 'hostile search text is safe');
select lives_ok($$select * from public.search_library('%_')$$, 'wildcards in short queries are safe');
select is((select count(*)::int from public.search_library('%_')), 0, 'escaped wildcards match nothing');
select tests.authenticate_as(:'s300');
select is((select array_agg(title) from public.library_resources), array['Beam design 300'], 'level-300 student sees only level 300');

-- Writes: students cannot create; reps manage within their level.
select throws_ok($$insert into public.library_resources (title, resource_type, level_code, copyright_basis, created_by) values ('Mine', 'other', '300', 'own_work', auth.uid())$$, '42501', null, 'non-manager cannot create resources');
select tests.authenticate_as(:'adm');
select public.grant_capability(:'rep', 'level_coordinator', '200', null, null, null, 'course rep for level 200');
select tests.authenticate_as(:'rep');
insert into public.library_resources (id, title, resource_type, level_code, copyright_basis, created_by)
values ('00000000-0000-0000-0000-00000000c504', 'Rep sheet', 'tutorial_sheet', '200', 'lecturer_permission', auth.uid());
select lives_ok($$select public.replace_audiences('library_resource_audiences', '00000000-0000-0000-0000-00000000c504', '[{"audience_kind":"level","level_code":"200"}]')$$, 'rep targets level 200');
select throws_ok($$select public.replace_audiences('library_resource_audiences', '00000000-0000-0000-0000-00000000c504', '[{"audience_kind":"level","level_code":"300"}]')$$, 'P0001', 'You cannot target that audience.', 'rep cannot target level 300');
select throws_ok($$update public.library_resources set copyright_basis = 'approved_past_question', resource_type = 'past_question' where id = '00000000-0000-0000-0000-00000000c504'$$, 'P0001', 'Only a department administrator can approve past questions.', 'reps cannot approve past questions');
select is((select count(*)::int from public.library_resources where id = '00000000-0000-0000-0000-00000000c503'), 0, 'rep does not see level-300 resources as staff');

-- Publish rules.
select tests.as_postgres();
insert into public.library_resources (id, title, resource_type, level_code, copyright_basis, created_by)
values ('00000000-0000-0000-0000-00000000c505', 'No audience', 'other', '200', 'own_work', :'adm');
insert into public.library_files (id, resource_id, version, storage_path, mime_type, size_bytes, original_filename, uploaded_by, scan_status)
values ('00000000-0000-0000-0000-00000000f505', '00000000-0000-0000-0000-00000000c505', 1, 'resources/x/f505.pdf', 'application/pdf', 10, 'x.pdf', :'adm', 'not_scanned');
select throws_ok($$update public.library_resources set current_file_id = '00000000-0000-0000-0000-00000000f505', status = 'published', published_by = (select created_by from public.library_resources where id = '00000000-0000-0000-0000-00000000c505') where id = '00000000-0000-0000-0000-00000000c505'$$,
  'P0001', 'Choose who should see this resource before publishing it.', 'publishing needs an audience');
select throws_ok($$update public.library_resources set status = 'published' where id = '00000000-0000-0000-0000-00000000c502'$$,
  'P0001', 'Upload a file before publishing this resource.', 'publishing needs a file');
select throws_ok($$insert into public.library_resources (title, resource_type, copyright_basis, created_by) select 'PQ', 'past_question', 'own_work', created_by from public.library_resources limit 1$$,
  '23514', null, 'past questions need approved_past_question');
select throws_ok($$update public.library_resources set current_file_id = '00000000-0000-0000-0000-00000000f503' where id = '00000000-0000-0000-0000-00000000c505'$$,
  'P0001', 'The file belongs to a different resource.', 'current file must belong to the resource');

-- Bookmarks and reports.
select tests.authenticate_as(:'s200');
select lives_ok($$insert into public.library_bookmarks (user_id, resource_id) values (auth.uid(), '00000000-0000-0000-0000-00000000c501')$$, 'bookmark a visible resource');
select throws_ok($$insert into public.library_bookmarks (user_id, resource_id) values (auth.uid(), '00000000-0000-0000-0000-00000000c503')$$, '42501', null, 'cannot bookmark an invisible resource');
insert into public.library_reports (resource_id, reporter_id, reason, details) values ('00000000-0000-0000-0000-00000000c501', auth.uid(), 'broken', 'The second page is blank.');
select tests.authenticate_as(:'s300');
select is((select count(*)::int from public.library_reports), 0, 'students cannot see other students'' reports');

-- Takedown hides everywhere immediately.
select tests.as_postgres();
update public.library_resources set status = 'removed', removed_at = now(), removal_reason = 'Copyright complaint upheld.' where id = '00000000-0000-0000-0000-00000000c501';
select tests.authenticate_as(:'s200');
select is((select count(*)::int from public.search_library('beam')), 0, 'removed resource disappears from search');
select is((select count(*)::int from public.library_bookmarks b join public.library_resources r on r.id = b.resource_id), 0, 'removed resource disappears from bookmarks');
select tests.as_postgres();
select is((select count(*)::int from public.library_files where resource_id = '00000000-0000-0000-0000-00000000c501'), 1, 'file rows remain for audit');

select * from finish();
rollback;
