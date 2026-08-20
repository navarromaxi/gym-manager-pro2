-- Agenda diaria con turnos. Ejecutar una vez en Supabase SQL Editor antes de publicar.
create table if not exists public.daily_events (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  slot_interval_minutes integer not null check (slot_interval_minutes between 5 and 240),
  capacity_per_slot integer not null check (capacity_per_slot > 0),
  accept_receipts boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.class_sessions add column if not exists daily_event_id uuid references public.daily_events(id) on delete cascade;
create index if not exists class_sessions_daily_event_id_idx on public.class_sessions(daily_event_id);

alter table public.daily_events enable row level security;
drop policy if exists "gym owners manage daily events" on public.daily_events;
create policy "gym owners manage daily events" on public.daily_events for all to authenticated
using (exists (select 1 from public.gyms g where g.id = daily_events.gym_id and g.user_id = auth.uid()))
with check (exists (select 1 from public.gyms g where g.id = daily_events.gym_id and g.user_id = auth.uid()));
