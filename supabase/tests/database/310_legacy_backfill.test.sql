-- E4 part 2: non-destructive legacy backfill into audiences, with a review queue.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('lb-admin@test.local', '{"full_name":"Admin","matric_number":"980000001"}') as adm \gset
select tests.create_user('lb-s1@test.local', '{"full_name":"Legacy Student","matric_number":"980000002"}') as s1 \gset
select tests.create_user('lb-nomatric@test.local', '{"full_name":"Google User"}') as nomat \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'s1', 'verified');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e310', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f310', '00000000-0000-0000-0000-00000000e310', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
select id as get209 from public.courses where course_code = 'GET209' \gset
select id as get211 from public.courses where course_code = 'GET211' \gset
insert into public.course_offerings (id, course_id, semester_id, level_code)
values ('00000000-0000-0000-0000-0000000a0310', :'get209', '00000000-0000-0000-0000-00000000f310', '200');

insert into public.announcements (id, title, content, scope, course_id, created_by, is_published, published_at) values
  ('00000000-0000-0000-0000-00000000a310', 'For all', 'Legacy department-wide notice.', 'all', null, :'adm', true, '2026-11-02 10:00+01'),
  ('00000000-0000-0000-0000-00000000a311', 'For level', 'Legacy level notice (200 pilot).', 'level', null, :'adm', true, '2026-11-02 10:00+01'),
  ('00000000-0000-0000-0000-00000000a312', 'GET209 test', 'Legacy course notice, in term.', 'course', :'get209', :'adm', true, '2026-11-02 10:00+01'),
  ('00000000-0000-0000-0000-00000000a313', 'GET211 test', 'Legacy course notice, no offering.', 'course', :'get211', :'adm', true, '2026-11-02 10:00+01');
insert into public.lecture_sessions (id, course_id, lecture_date, start_time, end_time, venue, created_by) values
  ('00000000-0000-0000-0000-00000000b310', :'get209', '2026-11-30', '09:00', '11:00', 'LT1', :'adm'),
  ('00000000-0000-0000-0000-00000000b311', :'get209', '2026-06-01', '09:00', '11:00', 'LT1', :'adm');
insert into public.quests (id, title, description, xp_reward, is_active, created_by, level_code) values
  ('00000000-0000-0000-0000-00000000d310', 'Level quest', 'A quest that P7 tagged for level 200.', 50, true, :'adm', '200'),
  ('00000000-0000-0000-0000-00000000d311', 'Old quest', 'A legacy quest without any audience.', 50, true, :'adm', null);

select public.run_legacy_backfill();

select is((select audience_kind from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a310'), 'department', 'scope all → department audience');
select is((select count(*)::int from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a311'), 0, 'scope level → no audience (hidden)');
select is((select details->>'suggested_level' from public.migration_review_items where item_type = 'announcement_level' and entity_id = '00000000-0000-0000-0000-00000000a311'), '200', 'scope level → review item with a suggestion');
select is((select offering_id from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a312'), '00000000-0000-0000-0000-0000000a0310'::uuid, 'in-term course notice → offering audience');
select is((select audience_kind from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a313'), 'course', 'course notice without an offering → course audience');
select is((select offering_id from public.lecture_sessions where id = '00000000-0000-0000-0000-00000000b310'), '00000000-0000-0000-0000-0000000a0310'::uuid, 'in-term lecture gets its offering');
select ok(exists (select 1 from public.migration_review_items where item_type = 'lecture_out_of_range' and entity_id = '00000000-0000-0000-0000-00000000b311'), 'out-of-term lecture → review item');
select is((select level_code from public.quest_audiences where quest_id = '00000000-0000-0000-0000-00000000d310'), '200', 'level-tagged quest → level audience');
select ok(exists (select 1 from public.migration_review_items where item_type = 'quest_audience' and entity_id = '00000000-0000-0000-0000-00000000d311'), 'untagged quest → review item');
select is((select status from public.student_placements where student_id = :'s1'), 'claimed', 'legacy student gets a claimed placement');
select ok(exists (select 1 from public.migration_review_items where item_type = 'placement' and entity_id = (select id from public.student_placements where student_id = :'s1')), 'placement → review item');
select ok(exists (select 1 from public.migration_review_items where item_type = 'profile_no_matric' and entity_id = :'nomat'), 'profile without matric → review item');

-- Idempotent.
select (select count(*) from public.migration_review_items) + (select count(*) from public.announcement_audiences)
     + (select count(*) from public.quest_audiences) + (select count(*) from public.student_placements) as before_count \gset
select public.run_legacy_backfill();
select is((select (select count(*) from public.migration_review_items) + (select count(*) from public.announcement_audiences)
     + (select count(*) from public.quest_audiences) + (select count(*) from public.student_placements)), :'before_count'::bigint, 'a second run creates nothing new');

select tests.authenticate_as(:'s1');
select is((select count(*)::int from public.migration_review_items), 0, 'students cannot read the review queue');

select * from finish();
rollback;
