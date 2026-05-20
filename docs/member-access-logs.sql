create table if not exists public.member_access_logs (
  id text primary key,
  gym_id text not null,
  member_id text null,
  member_name text null,
  cedula_entered text not null,
  normalized_cedula text not null,
  result text not null check (result in ('active', 'expiring', 'expired', 'not_found')),
  status_color text not null check (status_color in ('green', 'yellow', 'red')),
  message text not null,
  days_remaining integer null,
  days_expired integer null,
  created_at timestamptz not null default now()
);

create index if not exists member_access_logs_gym_created_at_idx
  on public.member_access_logs (gym_id, created_at desc);

create index if not exists member_access_logs_gym_cedula_idx
  on public.member_access_logs (gym_id, normalized_cedula);

create index if not exists member_access_logs_gym_result_created_at_idx
  on public.member_access_logs (gym_id, result, created_at desc);

create index if not exists member_access_logs_gym_member_created_at_idx
  on public.member_access_logs (gym_id, member_id, created_at desc);

alter table public.member_access_logs enable row level security;

drop policy if exists "member_access_logs_select_own_gym"
  on public.member_access_logs;

create policy "member_access_logs_select_own_gym"
  on public.member_access_logs
  for select
  using (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', ''));

create or replace function public.member_access_summary(
  p_gym_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  total_count bigint,
  active_count bigint,
  expiring_count bigint,
  expired_count bigint,
  not_found_count bigint,
  unique_members bigint
)
language sql
stable
as $$
  with filtered as (
    select member_id, result
    from public.member_access_logs
    where gym_id = p_gym_id
      and created_at >= p_from
      and created_at <= p_to
  )
  select
    count(*)::bigint as total_count,
    count(*) filter (where result = 'active')::bigint as active_count,
    count(*) filter (where result = 'expiring')::bigint as expiring_count,
    count(*) filter (where result = 'expired')::bigint as expired_count,
    count(*) filter (where result = 'not_found')::bigint as not_found_count,
    count(distinct member_id)::bigint as unique_members
  from filtered;
$$;

create or replace function public.member_access_peak_hours(
  p_gym_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 5
)
returns table (
  hour_of_day integer,
  access_count bigint
)
language sql
stable
as $$
  select
    extract(hour from created_at)::integer as hour_of_day,
    count(*)::bigint as access_count
  from public.member_access_logs
  where gym_id = p_gym_id
    and created_at >= p_from
    and created_at <= p_to
  group by 1
  order by access_count desc, hour_of_day asc
  limit greatest(coalesce(p_limit, 5), 1);
$$;

create or replace function public.member_access_top_members(
  p_gym_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (
  member_id text,
  member_name text,
  access_count bigint,
  last_access timestamptz
)
language sql
stable
as $$
  select
    l.member_id,
    max(l.member_name) as member_name,
    count(*)::bigint as access_count,
    max(l.created_at) as last_access
  from public.member_access_logs l
  where l.gym_id = p_gym_id
    and l.member_id is not null
    and l.created_at >= p_from
    and l.created_at <= p_to
  group by l.member_id
  order by access_count desc, last_access desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;
