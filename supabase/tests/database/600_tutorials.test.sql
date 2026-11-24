-- P9 tutorials: provider checks, AI videos disabled, review before publish, visibility, progress, playlists.
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('tu-admin@test.local', '{"full_name":"Admin","matric_number":"993000001"}') as adm \gset
select tests.create_user('tu-admin2@test.local', '{"full_name":"Admin Two","matric_number":"993000002"}') as adm2 \gset
select tests.create_user('tu-rep@test.local', '{"full_name":"Rep","matric_number":"993000003"}') as rep \gset
select tests.create_user('tu-s200@test.local', '{"full_name":"Two","matric_number":"993000004"}') as s200 \gset
select tests.create_user('tu-s300@test.local', '{"full_name":"Three","matric_number":"993000005"}') as s300 \gset
select tests.create_user('tu-s200b@test.local', '{"full_name":"Two B","matric_number":"993000006"}') as s200b \gset
select tests.make_admin(:'adm');
select tests.make_admin(:'adm2');
select tests.set_verification(:'adm', 'verified');
select tests.set_verification(:'adm2', 'verified');
select tests.set_verification(:'rep', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'s300', 'verified');
select tests.set_verification(:'s200b', 'verified');
insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e600', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'s200', '00000000-0000-0000-0000-00000000e600', '200', 'confirmed'),
  (:'s200b', '00000000-0000-0000-0000-00000000e600', '200', 'confirmed'),
  (:'s300', '00000000-0000-0000-0000-00000000e600', '300', 'confirmed');

-- Provider checks.
select throws_ok(format($$insert into public.tutorials (title, topic, source_type, provider, provider_video_id, external_url, created_by)
  values ('Bad id', 'Beams', 'youtube', 'youtube', 'abc', 'https://www.youtube.com/watch?v=abc', %L)$$, :'adm'), '23514', null, 'YouTube ids must be 11 characters');
select throws_ok(format($$insert into public.tutorials (title, topic, source_type, provider, external_url, created_by)
  values ('Http link', 'Beams', 'external_platform', 'other_allowlisted', 'http://ocw.mit.edu/x', %L)$$, :'adm'), '23514', null, 'other providers need https');

-- AI-generated videos are disabled for now.
select throws_ok(format($$insert into public.tutorials (title, topic, source_type, provider, provider_video_id, external_url, is_ai_generated, ai_tool, ai_disclosure, created_by)
  values ('AI video', 'Beams', 'ai_generated', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 'Tool', 'Generated.', %L)$$, :'adm'), '23514', null, 'AI-generated videos are refused');

-- A level-200 tutorial created by admin A.
select tests.authenticate_as(:'adm');
insert into public.tutorials (id, title, description, topic, level_code, source_type, provider, provider_video_id, external_url,
  learning_objectives, created_by)
values ('00000000-0000-0000-0000-00000000a601', 'Shear force diagrams', 'Walkthrough of SFDs.', 'Beams', '200', 'youtube',
  'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', array['Draw an SFD for a simply supported beam'], auth.uid());
select lives_ok($$select public.replace_audiences('tutorial_audiences', '00000000-0000-0000-0000-00000000a601', '[{"audience_kind":"level","level_code":"200"}]')$$, 'audience set');
select throws_ok($$update public.tutorials set status = 'published' where id = '00000000-0000-0000-0000-00000000a601'$$,
  'P0001', 'This tutorial must be reviewed and approved before publishing.', 'cannot publish before review');
select throws_ok($$select public.review_tutorial('00000000-0000-0000-0000-00000000a601', 'approved', 'Looks accurate to me.')$$,
  'P0001', 'You cannot review your own content.', 'the creator cannot review');
select throws_ok($$update public.tutorials set review_status = 'approved' where id = '00000000-0000-0000-0000-00000000a601'$$,
  '42501', null, 'review fields cannot be written directly');

select tests.authenticate_as(:'adm2');
select lives_ok($$select public.review_tutorial('00000000-0000-0000-0000-00000000a601', 'approved', 'Checked against CEE201 notes.')$$, 'a second admin approves');
select lives_ok($$update public.tutorials set status = 'published' where id = '00000000-0000-0000-0000-00000000a601'$$, 'approved tutorial publishes');

-- Visibility.
select tests.authenticate_as(:'s200');
select is((select count(*)::int from public.tutorials), 1, 'level-200 student sees the tutorial');
select is((select count(*)::int from public.search_tutorials('shear')), 1, 'search finds it');
select tests.authenticate_as(:'s300');
select is((select count(*)::int from public.tutorials), 0, 'level-300 student cannot see a level-200 tutorial');

-- Progress: own rows only, 0–100.
select tests.authenticate_as(:'s200');
select lives_ok($$insert into public.tutorial_progress (user_id, tutorial_id, status, percent_watched) values (auth.uid(), '00000000-0000-0000-0000-00000000a601', 'in_progress', 40)$$, 'own progress');
select throws_ok(format($$insert into public.tutorial_progress (user_id, tutorial_id, status, percent_watched) values (%L, '00000000-0000-0000-0000-00000000a601', 'completed', 100)$$, :'s200b'),
  '42501', null, 'cannot write another student''s progress');
select throws_ok($$update public.tutorial_progress set percent_watched = 101 where user_id = auth.uid()$$, '23514', null, 'progress is capped at 100');
select lives_ok($$insert into public.tutorial_saves (user_id, tutorial_id) values (auth.uid(), '00000000-0000-0000-0000-00000000a601')$$, 'save a visible tutorial');

-- Personal playlists are private.
insert into public.tutorial_playlists (id, owner_id, title) values ('00000000-0000-0000-0000-00000000b601', auth.uid(), 'Exam revision');
insert into public.tutorial_playlist_items (playlist_id, tutorial_id, position) values ('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000a601', 1);
select tests.authenticate_as(:'s200b');
select is((select count(*)::int from public.tutorial_playlists), 0, 'other students cannot see a personal playlist');

-- Editing a published (non-AI) tutorial keeps it published.
select tests.authenticate_as(:'adm');
update public.tutorials set description = 'Edited walkthrough.' where id = '00000000-0000-0000-0000-00000000a601';
select tests.as_postgres();
select is((select status from public.tutorials where id = '00000000-0000-0000-0000-00000000a601'), 'published', 'edits to a normal tutorial do not unpublish it');

-- Course reps review only inside their level.
select tests.authenticate_as(:'adm');
select public.grant_capability(:'rep', 'level_coordinator', '300', null, null, null, 'course rep for level 300');
select tests.authenticate_as(:'rep');
select throws_ok($$select public.review_tutorial('00000000-0000-0000-0000-00000000a601', 'approved', 'Approving outside my level.')$$,
  'P0001', 'You cannot review this tutorial.', 'reps cannot review other levels');

select * from finish();
rollback;
