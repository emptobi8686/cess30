-- BP-007: rejected students can resubmit; admins can suspend, reinstate and reopen.
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('vt-admin@test.local', '{"full_name":"Admin","matric_number":"700000001"}') as adm \gset
select tests.create_user('vt-rejected@test.local', '{"full_name":"Rejected","matric_number":"700000002"}') as rej \gset
select tests.create_user('vt-pending@test.local', '{"full_name":"Pending","matric_number":"700000003"}') as pen \gset
select tests.create_user('vt-verified@test.local', '{"full_name":"Verified","matric_number":"700000004"}') as ver \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'rej', 'rejected');
select tests.set_verification(:'ver', 'verified');
select tests.set_verification(:'adm', 'verified');

-- Student resubmission.
select tests.authenticate_as(:'rej');
select lives_ok($$select public.request_reverification('700000002')$$, 'rejected student can resubmit the same matric');
select tests.as_postgres();
select is((select verification_status from public.profiles where id = :'rej'), 'pending', 'resubmission returns the profile to pending');
select results_eq(
  format($$select previous_status, new_status from public.profile_verification_history where profile_id = %L$$, :'rej'),
  $$values ('rejected'::text, 'pending'::text)$$,
  'resubmission is recorded in history');

select tests.authenticate_as(:'pen');
select throws_ok($$select public.request_reverification('700000099')$$, 'P0001', null, 'only rejected students can resubmit');

-- Admin transitions.
select tests.authenticate_as(:'adm');
select throws_ok(
  format($$select public.admin_change_status(%L, 'suspended', 'short')$$, :'ver'),
  'P0001', null, 'suspension needs a reason of at least 12 characters');
select lives_ok(
  format($$select public.admin_change_status(%L, 'suspended', 'Repeated misuse of the platform')$$, :'ver'),
  'admin can suspend a verified student');
select throws_ok(
  format($$select public.admin_change_status(%L, 'suspended', 'Self suspension attempt')$$, :'adm'),
  'P0001', null, 'admin cannot change their own status');
select lives_ok(
  format($$select public.admin_change_status(%L, 'verified', null)$$, :'ver'),
  'admin can reinstate a suspended student');
select throws_ok(
  format($$select public.admin_change_status(%L, 'pending', null)$$, :'ver'),
  'P0001', null, 'verified cannot be moved back to pending');

select tests.authenticate_as(:'ver');
select throws_ok(
  format($$select public.admin_change_status(%L, 'suspended', 'Student tries to suspend admin')$$, :'adm'),
  'P0001', null, 'students cannot call admin transitions');

select tests.as_postgres();
select results_eq(
  format($$select count(*)::int from public.profile_verification_history where profile_id = %L$$, :'ver'),
  array[2], 'suspend and reinstate are both recorded');

select * from finish();
rollback;
