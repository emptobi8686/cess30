-- E6 / decision 0004: scoped, expiring, audited staff capabilities.
-- Approved subset: department_admin and level_coordinator (course representatives).
begin;
\ir _helpers.psql
select plan(21);

select tests.create_user('cap-a@test.local', '{"full_name":"Admin A","matric_number":"950000001"}') as adm_a \gset
select tests.create_user('cap-b@test.local', '{"full_name":"Admin B","matric_number":"950000002"}') as adm_b \gset
select tests.create_user('cap-rep@test.local', '{"full_name":"Rep","matric_number":"950000003"}') as rep \gset
select tests.create_user('cap-new@test.local', '{"full_name":"New Admin","matric_number":"950000004"}') as newadm \gset
select tests.create_user('cap-stu@test.local', '{"full_name":"Pending","matric_number":"950000005"}') as pend \gset
select tests.make_admin(:'adm_a');
select tests.make_admin(:'adm_b');
select tests.set_verification(:'rep', 'verified');
select tests.set_verification(:'newadm', 'verified');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e401', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f401', '00000000-0000-0000-0000-00000000e401', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
insert into public.course_offerings (id, course_id, semester_id, level_code)
select '00000000-0000-0000-0000-0000000a0401', id, '00000000-0000-0000-0000-00000000f401', '200' from public.courses where course_code = 'GET209';
insert into public.course_offerings (id, course_id, semester_id, level_code)
select '00000000-0000-0000-0000-0000000a0402', id, '00000000-0000-0000-0000-00000000f401', '300' from public.courses where course_code = 'GET211';

-- Backward compatibility: existing admins hold every capability with zero assignments.
select tests.authenticate_as(:'adm_a');
select ok(public.has_capability('department_admin'), 'legacy admin is a department admin');
select ok(public.has_capability('level_coordinator', '300'), 'legacy admin covers any level');

-- Separation of duties and validation.
select throws_ok(format($$select public.grant_capability(%L, 'department_admin', null, null, null, null, 'self promotion attempt')$$, :'adm_a'),
  'P0001', 'You cannot grant a capability to yourself.', 'self-grant is refused');
select throws_ok(format($$select public.grant_capability(%L, 'level_coordinator', null, null, null, null, 'course rep for level')$$, :'rep'),
  'P0001', 'A course representative must be assigned to one level.', 'level coordinator needs a level');
select throws_ok(format($$select public.grant_capability(%L, 'level_coordinator', '200', null, null, null, 'short')$$, :'rep'),
  'P0001', 'Give a reason of at least 8 characters.', 'reason is required');
select throws_ok(format($$select public.grant_capability(%L, 'level_coordinator', '200', null, null, null, 'course rep for level 200')$$, :'pend'),
  'P0001', 'Only verified students can be given staff capabilities.', 'unverified users cannot be granted');
select throws_ok(format($$select public.grant_capability(%L, 'library_manager', null, null, null, null, 'library duties for dept')$$, :'rep'),
  'P0001', 'That capability is not enabled yet.', 'capabilities outside the approved subset are refused');

-- Grant a course representative for level 200; it expires with the session.
select public.grant_capability(:'rep', 'level_coordinator', '200', null, null, null, 'course rep for level 200') as rep_grant \gset
select tests.as_postgres();
select is((select (expires_at at time zone 'Africa/Lagos')::date from public.staff_assignments where id = :'rep_grant'), '2027-10-01'::date,
  'level assignment expires at the end of the current session (Lagos)');
select is((select count(*)::int from public.staff_assignment_events where assignment_id = :'rep_grant' and action = 'granted'), 1, 'grant is logged');

select tests.authenticate_as(:'rep');
select ok(public.has_capability('level_coordinator', '200'), 'rep covers level 200');
select ok(not public.has_capability('level_coordinator', '300'), 'rep does not cover level 300');
select ok(public.has_capability('level_coordinator', null, null, '00000000-0000-0000-0000-0000000a0401'), 'rep covers a level-200 offering');
select ok(not public.has_capability('level_coordinator', null, null, '00000000-0000-0000-0000-0000000a0402'), 'rep does not cover a level-300 offering');
select ok(not public.has_capability('department_admin'), 'rep is not a department admin');
select throws_ok($$select public.grant_capability(gen_random_uuid(), 'level_coordinator', '200', null, null, null, 'rep tries to grant')$$,
  'P0001', 'Department administrator access required.', 'reps cannot grant');
select throws_ok($$insert into public.staff_assignments (user_id, capability, level_code, granted_by, reason) values (auth.uid(), 'department_admin', null, auth.uid(), 'direct write attempt')$$,
  '42501', null, 'no direct writes to staff_assignments');

-- Expiry and revocation stop access immediately.
select tests.as_postgres();
update public.staff_assignments set expires_at = now() - interval '1 minute' where id = :'rep_grant';
select tests.authenticate_as(:'rep');
select ok(not public.has_capability('level_coordinator', '200'), 'expired assignment grants nothing');
select tests.as_postgres();
update public.staff_assignments set expires_at = now() + interval '1 day' where id = :'rep_grant';
select tests.authenticate_as(:'adm_a');
select public.revoke_capability(:'rep_grant', 'rep stepped down');
select tests.authenticate_as(:'rep');
select ok(not public.has_capability('level_coordinator', '200'), 'revoked assignment grants nothing');

-- Two-person rule for department admins.
select tests.authenticate_as(:'adm_a');
select public.grant_capability(:'newadm', 'department_admin', null, null, null, null, 'second department admin') as dept_grant \gset
select tests.authenticate_as(:'newadm');
select ok(not public.has_capability('department_admin'), 'pending department admin grant is inactive');
select tests.authenticate_as(:'adm_a');
select throws_ok(format($$select public.approve_capability(%L)$$, :'dept_grant'),
  'P0001', 'Another department administrator must approve this.', 'the granting admin cannot approve');
select tests.authenticate_as(:'adm_b');
select public.approve_capability(:'dept_grant');
select tests.authenticate_as(:'newadm');
select ok(public.has_capability('department_admin') and public.is_admin(), 'approved department admin is active and an admin');

select * from finish();
rollback;
