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

alter table public.member_access_logs enable row level security;

drop policy if exists "member_access_logs_select_own_gym"
  on public.member_access_logs;

create policy "member_access_logs_select_own_gym"
  on public.member_access_logs
  for select
  using (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', ''));
