-- E4: content audiences and the audience_matches / can_view_* / replace_audiences helpers.
begin;
\ir _helpers.psql
select plan(24);

select tests.create_user('au-admin@test.local', '{"full_name":"Admin","matric_number":"970000001"}') as adm \gset
select tests.create_user('au-s200@test.local', '{"full_name":"Two","matric_number":"970000002"}') as s200 \gset
select tests.create_user('au-s300@test.local', '{"full_name":"Three","matric_number":"970000003"}') as s300 \gset
select tests.create_user('au-pend@test.local', '{"full_name":"Pending","matric_number":"970000004"}') as pend \gset
select tests.create_user('au-rep@test.local', '{"full_name":"Rep","matric_number":"970000005"}') as rep \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'adm', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'s300', 'verified');
select tests.set_verification(:'rep', 'verified');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current) values
  ('00000000-0000-0000-0000-00000000e300', '2025/2026', '2025-10-01', '2026-09-30', false),
  ('00000000-0000-0000-0000-00000000e301', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e301', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
insert into public.courses (id, course_code, course_title, credit_units, level, department)
values ('00000000-0000-0000-0000-0000000c0300', 'CEE301', 'Structural Analysis I', 3, '300', 'Civil Engineering');
select id as get209 from public.courses where course_code = 'GET209' \gset
select id as dept from public.departments where code = 'CVE' \gset
insert into public.course_offerings (id, course_id, semester_id, level_code) values
  ('00000000-0000-0000-0000-0000000a0301', :'get209', '00000000-0000-0000-0000-00000000f301', '200'),
  ('00000000-0000-0000-0000-0000000a0302', '00000000-0000-0000-0000-0000000c0300', '00000000-0000-0000-0000-00000000f301', '300');
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'s200', '00000000-0000-0000-0000-00000000e301', '200', 'confirmed'),
  (:'s300', '00000000-0000-0000-0000-00000000e301', '300', 'confirmed'),
  (:'pend', '00000000-0000-0000-0000-00000000e301', '200', 'claimed');
insert into public.course_enrollments (student_id, offering_id, enrolment_type) values
  (:'s200', '00000000-0000-0000-0000-0000000a0301', 'core'),
  (:'s300', '00000000-0000-0000-0000-0000000a0302', 'core'),
  (:'s300', '00000000-0000-0000-0000-0000000a0301', 'carryover');

-- audience_matches ---------------------------------------------------------------
select tests.authenticate_as(:'s200');
select ok(not public.audience_matches('level', null, '300', null, null, null, null), 'level 300 does not match a 200 student');
select ok(public.audience_matches('offering', null, null, null, '00000000-0000-0000-0000-0000000a0301', null, null), 'GET209@200 matches the 200 student');
select ok(not public.audience_matches('course', null, null, '00000000-0000-0000-0000-0000000c0300', null, null, null), 'CEE301 course does not match the 200 student');
select ok(not public.audience_matches('staff_only', null, null, null, null, null, null), 'staff_only matches no student');
select ok(not public.audience_matches('level', null, '200', null, null, '00000000-0000-0000-0000-00000000e300', null), 'a past-session level audience does not match');
select ok(public.audience_matches('department', :'dept', null, null, null, null, null), 'department audience matches');
select tests.authenticate_as(:'s300');
select ok(public.audience_matches('level', null, '300', null, null, null, null), 'level 300 matches the 300 student');
select ok(public.audience_matches('offering', null, null, null, '00000000-0000-0000-0000-0000000a0301', null, null), 'carry-over student matches GET209@200');
select ok(public.audience_matches('course', null, null, '00000000-0000-0000-0000-0000000c0300', null, null, null), 'course audience matches an enrolled offering');

-- can_view_* ------------------------------------------------------------------------
select tests.as_postgres();
insert into public.announcements (id, title, content, scope, course_id, created_by, is_published, published_at) values
  ('00000000-0000-0000-0000-00000000a301', 'Level 300 only', 'For level 300 students.', 'level', null, :'adm', true, now()),
  ('00000000-0000-0000-0000-00000000a302', 'Department notice', 'For everyone in the department.', 'department', null, :'adm', true, now()),
  ('00000000-0000-0000-0000-00000000a303', 'Rep draft', 'A draft by the course rep.', 'course', :'get209', :'rep', false, now());
insert into public.announcement_audiences (announcement_id, audience_kind, level_code, created_by) values
  ('00000000-0000-0000-0000-00000000a301', 'level', '300', :'adm');
insert into public.announcement_audiences (announcement_id, audience_kind, department_id, created_by) values
  ('00000000-0000-0000-0000-00000000a302', 'department', :'dept', :'adm');
insert into public.lecture_sessions (id, course_id, offering_id, lecture_date, start_time, end_time, venue, created_by) values
  ('00000000-0000-0000-0000-00000000b301', :'get209', '00000000-0000-0000-0000-0000000a0301', '2026-11-30', '09:00', '11:00', 'LT1', :'adm'),
  ('00000000-0000-0000-0000-00000000b302', '00000000-0000-0000-0000-0000000c0300', '00000000-0000-0000-0000-0000000a0302', '2026-11-30', '12:00', '14:00', 'LT2', :'adm');

select tests.authenticate_as(:'s200');
select ok(not public.can_view_announcement('00000000-0000-0000-0000-00000000a301'), '200 student cannot view a level-300 announcement');
select ok(public.can_view_announcement('00000000-0000-0000-0000-00000000a302'), '200 student views a department announcement');
select ok(public.can_view_lecture('00000000-0000-0000-0000-00000000b301') and not public.can_view_lecture('00000000-0000-0000-0000-00000000b302'), '200 student sees GET209, not CEE301 lectures');
select tests.authenticate_as(:'s300');
select ok(public.can_view_lecture('00000000-0000-0000-0000-00000000b301') and public.can_view_lecture('00000000-0000-0000-0000-00000000b302'), 'carry-over student sees GET209 and CEE301 lectures');
select tests.authenticate_as(:'pend');
select ok(public.can_view_announcement('00000000-0000-0000-0000-00000000a302'), 'pending student reads department announcements');
select ok(public.can_view_lecture('00000000-0000-0000-0000-00000000b301') and not public.can_view_lecture('00000000-0000-0000-0000-00000000b302'), 'pending student sees the timetable of their claimed level');
select tests.as_postgres();
select tests.set_verification(:'pend', 'suspended');
select tests.authenticate_as(:'pend');
select ok(not public.can_view_announcement('00000000-0000-0000-0000-00000000a302'), 'suspended student sees nothing');

-- replace_audiences ------------------------------------------------------------------
select tests.authenticate_as(:'adm');
select public.grant_capability(:'rep', 'level_coordinator', '200', null, null, null, 'course rep for level 200');
select tests.authenticate_as(:'rep');
select lives_ok($$select public.replace_audiences('announcement_audiences', '00000000-0000-0000-0000-00000000a303', '[{"audience_kind":"level","level_code":"200"},{"audience_kind":"offering","offering_id":"00000000-0000-0000-0000-0000000a0301"}]'::jsonb)$$, 'rep targets level 200 and GET209@200');
select is((select count(*)::int from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a303'), 2, 'two audience rows written');
select throws_ok($$select public.replace_audiences('announcement_audiences', '00000000-0000-0000-0000-00000000a303', '[{"audience_kind":"level","level_code":"300"}]'::jsonb)$$, 'P0001', 'You cannot target that audience.', 'rep cannot target level 300');
select throws_ok($$select public.replace_audiences('announcement_audiences', '00000000-0000-0000-0000-00000000a303', '[{"audience_kind":"department"}]'::jsonb)$$, 'P0001', 'You cannot target that audience.', 'rep cannot target the department');
select throws_ok($$select public.replace_audiences('announcement_audiences', '00000000-0000-0000-0000-00000000a302', '[{"audience_kind":"level","level_code":"200"}]'::jsonb)$$, 'P0001', 'You cannot change who sees this.', 'rep cannot retarget a department announcement');
select throws_ok($$select public.replace_audiences('profiles', '00000000-0000-0000-0000-00000000a303', '[]'::jsonb)$$, 'P0001', 'Unknown audience table.', 'only allow-listed tables');
select throws_ok($$insert into public.announcement_audiences (announcement_id, audience_kind, level_code, created_by) values ('00000000-0000-0000-0000-00000000a303', 'level', '300', auth.uid())$$, '42501', null, 'no direct audience writes');
select tests.authenticate_as(:'adm');
select lives_ok(format($$select public.replace_audiences('announcement_audiences', '00000000-0000-0000-0000-00000000a303', '[{"audience_kind":"department","department_id":"%s"}]'::jsonb)$$, :'dept'), 'admin targets the department');

select * from finish();
rollback;
