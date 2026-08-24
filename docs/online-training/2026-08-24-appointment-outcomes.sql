-- Historial de resultados de reuniones de entrenamiento online.
-- Ejecutar una única vez en Supabase SQL Editor.

alter table public.online_training_appointments
  add column if not exists outcome_notes text,
  add column if not exists outcome_recorded_at timestamptz;

alter table public.online_training_appointments
  drop constraint if exists online_training_appointments_status_check;

alter table public.online_training_appointments
  add constraint online_training_appointments_status_check
  check (status in ('confirmed', 'cancelled', 'completed', 'no_show', 'not_completed'));

create index if not exists online_training_appointments_client_history_index
  on public.online_training_appointments (client_id, starts_at desc);
