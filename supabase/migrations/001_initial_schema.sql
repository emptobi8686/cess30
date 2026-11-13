create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  matric_number text not null,
  department text not null default 'Civil Engineering',
  level text not null default '200',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_matric_number_unique unique (matric_number),
  constraint profiles_level_check check (level in ('100','200','300','400','500'))
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_title text not null,
  credit_units integer not null check (credit_units > 0),
  level text not null default '200',
  department text not null default 'Civil Engineering',
  created_at timestamptz not null default now(),
  constraint courses_level_check check (level in ('100','200','300','400','500'))
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student','admin')),
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

create table if not exists public.lecture_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lecture_date date not null,
  start_time time not null,
  end_time time not null,
  venue text not null,
  lecturer_name text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lecture_sessions_time_range_check check (start_time < end_time)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  study_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_time_range_check check (start_time < end_time)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  scope text not null check (scope in ('all','department','level','course')),
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_matric_number_idx on public.profiles(matric_number);
create index if not exists courses_level_department_idx on public.courses(level, department);
create index if not exists lecture_sessions_date_idx on public.lecture_sessions(lecture_date);
create index if not exists study_sessions_user_date_idx on public.study_sessions(user_id, study_date);
create index if not exists announcements_published_idx on public.announcements(published_at desc);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.update_updated_at_column();

create trigger set_lecture_sessions_updated_at
before update on public.lecture_sessions
for each row
execute procedure public.update_updated_at_column();

create trigger set_study_sessions_updated_at
before update on public.study_sessions
for each row
execute procedure public.update_updated_at_column();

create trigger set_announcements_updated_at
before update on public.announcements
for each row
execute procedure public.update_updated_at_column();
