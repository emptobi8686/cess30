-- A verified student's requested (claimed) level for the current session receives that
-- level's content immediately; confirmation is only needed for enrolment. Pending
-- students still see department-wide content only.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('lc-admin@test.local', '{"full_name":"Admin","matric_number":"994000001"}') as adm \gset
select tests.create_user('lc-claim@test.local', '{"full_name":"Claimed","matric_number":"994000002"}') as claim \gset
select tests.create_user('lc-pend@test.local', '{"full_name":"Pending","matric_number":"994000003"}') as pend \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'claim', 'verified');
insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e350', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'claim', '00000000-0000-0000-0000-00000000e350', '200', 'claimed'),
  (:'pend', '00000000-0000-0000-0000-00000000e350', '200', 'claimed');
select id as get209 from public.courses where course_code = 'GET209' \gset
insert into public.announcements (id, title, content, scope, created_by, is_published, published_at)
values ('00000000-0000-0000-0000-00000000a350', 'Level 200 notice', 'For level 200.', 'level', :'adm', true, now() - interval '1 minute');
insert into public.announcement_audiences (announcement_id, audience_kind, level_code) values ('00000000-0000-0000-0000-00000000a350', 'level', '200');
insert into public.quests (id, title, description, xp_reward, is_active, created_by)
values ('00000000-0000-0000-0000-00000000d350', 'Level 200 quest', 'A quest for level 200.', 10, true, :'adm');
insert into public.quest_audiences (quest_id, audience_kind, level_code) values ('00000000-0000-0000-0000-00000000d350', 'level', '200');
insert into public.lecture_sessions (id, course_id, lecture_date, start_time, end_time, venue, created_by)
values ('00000000-0000-0000-0000-00000000b350', :'get209', ((now() at time zone 'Africa/Lagos') + interval '1 day')::date, '09:00', '11:00', 'LT1', :'adm');

select tests.authenticate_as(:'claim');
select is((select count(*)::int from public.announcements), 1, 'verified student with a requested level sees that level''s announcement');
select is((select count(*)::int from public.quests where is_active), 1, 'and its quest');
select is((select count(*)::int from public.lecture_sessions), 1, 'and its timetable');
select tests.as_postgres();
select is((select count(*)::int from public.announcement_recipients('00000000-0000-0000-0000-00000000a350')), 1, 'and is notified');

select tests.authenticate_as(:'pend');
select is((select count(*)::int from public.announcements), 0, 'pending students still do not see level content');
select is((select count(*)::int from public.quests), 0, 'nor quests');

select * from finish();
rollback;
