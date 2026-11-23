-- Migration 021: Repair get_leaderboard() (audit finding BP-004).
--
-- 019's PL/pgSQL version could never return rows:
--   * sum()/count()/rank() yield bigint but the function declared integer columns (42804);
--   * the unqualified final SELECT collided with the RETURNS TABLE output variables (42702).
-- It also silently returned nothing for unknown periods and ranked unverified
-- students and administrators.
--
-- The replacement is a plain SQL function: bigint outputs, every column qualified,
-- period validated, and only verified, non-admin students ranked. Week and month
-- boundaries are computed in Africa/Lagos (weeks start on Monday).
-- The return type changes, so the old function must be dropped first.

drop function if exists public.get_leaderboard(text);

-- Raises a clear error for unsupported periods. A separate function is used because
-- a SQL function cannot RAISE directly. It is volatile so the
-- planner never constant-folds the error branch.
create or replace function public.leaderboard_invalid_period(p_period text)
returns text
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Unsupported leaderboard period: %', p_period using errcode = '22023';
end;
$$;


create function public.get_leaderboard(p_period text default 'all-time')
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_xp bigint,
  quests_completed bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with params as (
    select
      case
        when p_period in ('all-time', 'weekly', 'monthly') then p_period
        else public.leaderboard_invalid_period(p_period)
      end as period,
      (now() at time zone 'Africa/Lagos')::date as today
  ),
  bounds as (
    select
      params.period,
      case params.period
        when 'weekly' then params.today - ((extract(isodow from params.today)::int) - 1)
        when 'monthly' then date_trunc('month', params.today)::date
        else null
      end as starts_on,
      case params.period
        when 'weekly' then params.today - ((extract(isodow from params.today)::int) - 1) + 6
        when 'monthly' then (date_trunc('month', params.today) + interval '1 month - 1 day')::date
        else null
      end as ends_on
    from params
  ),
  eligible as (
    select p.id, p.full_name, p.avatar_url
    from public.profiles p
    where p.verification_status = 'verified'
      and not exists (
        select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin'
      )
  ),
  totals as (
    select
      x.user_id,
      sum(x.xp_amount)::bigint as total_xp,
      count(x.quest_id)::bigint as quests_completed
    from public.xp_ledger x
    cross join bounds
    where bounds.starts_on is null
       or (x.created_at at time zone 'Africa/Lagos')::date between bounds.starts_on and bounds.ends_on
    group by x.user_id
  )
  select
    e.id as user_id,
    e.full_name,
    e.avatar_url,
    t.total_xp,
    t.quests_completed,
    rank() over (order by t.total_xp desc, e.full_name asc) as rank
  from totals t
  join eligible e on e.id = t.user_id
  order by rank, e.full_name;
$$;

revoke all on function public.leaderboard_invalid_period(text) from public, anon, authenticated;
revoke all on function public.get_leaderboard(text) from public, anon;
grant execute on function public.get_leaderboard(text) to authenticated, service_role;
