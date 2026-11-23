-- BP-050: announcement title and content have database length limits.
begin;
\ir _helpers.sql
select plan(3);

select tests.create_user('al-admin@test.local', '{"full_name":"Admin","matric_number":"910000001"}') as adm \gset
select tests.make_admin(:'adm');
select tests.authenticate_as(:'adm');

select throws_ok(
  format($$insert into public.announcements (title, content, scope, created_by) values (repeat('t', 161), 'Body', 'all', %L)$$, :'adm'),
  '23514', null, 'titles over 160 characters are rejected');
select throws_ok(
  format($$insert into public.announcements (title, content, scope, created_by) values ('Title', repeat('c', 5001), 'all', %L)$$, :'adm'),
  '23514', null, 'content over 5000 characters is rejected');
select lives_ok(
  format($$insert into public.announcements (title, content, scope, created_by) values (repeat('t', 160), repeat('c', 5000), 'all', %L)$$, :'adm'),
  'limits are inclusive');

select * from finish();
rollback;
