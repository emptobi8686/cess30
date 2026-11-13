insert into public.courses (course_code, course_title, credit_units, level, department)
values
  ('CEE201', 'Civil Engineering Drawing', 2, '200', 'Civil Engineering'),
  ('ENT211', 'Entrepreneurship and Innovation', 2, '200', 'Civil Engineering'),
  ('GET201', 'Applied Electricity', 3, '200', 'Civil Engineering'),
  ('GET205', 'Fundamentals of Fluid Mechanics', 3, '200', 'Civil Engineering'),
  ('GET207', 'Applied Mechanics', 3, '200', 'Civil Engineering'),
  ('GET209', 'Engineering Mathematics I', 3, '200', 'Civil Engineering'),
  ('GET211', 'Computer and Software Engineering', 3, '200', 'Civil Engineering')
on conflict (course_code) do update
set course_title = excluded.course_title,
    credit_units = excluded.credit_units,
    level = excluded.level,
    department = excluded.department;
