-- OPERACIÓN DEL SERVICIO DE RUTINAS ONLINE
-- Ejecutar una única vez luego de la base de entrenamiento online.
-- No modifica tablas ni datos de los gimnasios existentes.

create table if not exists public.online_training_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.online_training_clients(id) on delete cascade,
  notification_type text not null check (notification_type in ('renewal_reminder', 'period_ended', 'service_expired', 'payment_confirmed')),
  sent_at timestamptz not null default now(),
  unique (client_id, notification_type)
);

create index if not exists online_training_notifications_client_index
  on public.online_training_notifications (client_id, sent_at desc);

alter table public.online_training_notifications enable row level security;

create table if not exists public.online_training_appointments (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  client_id uuid not null references public.online_training_clients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (gym_id, starts_at)
);

create index if not exists online_training_appointments_gym_start_index
  on public.online_training_appointments (gym_id, starts_at);
create index if not exists online_training_appointments_client_index
  on public.online_training_appointments (client_id, starts_at desc);

alter table public.online_training_appointments enable row level security;

drop policy if exists "online training appointments own gym" on public.online_training_appointments;
create policy "online training appointments own gym"
  on public.online_training_appointments for all to authenticated
  using (exists (select 1 from public.gyms g where g.id = online_training_appointments.gym_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.gyms g where g.id = online_training_appointments.gym_id and g.user_id = auth.uid()));

drop trigger if exists online_training_appointments_updated_at on public.online_training_appointments;
create trigger online_training_appointments_updated_at
  before update on public.online_training_appointments
  for each row execute function public.online_training_set_updated_at();
