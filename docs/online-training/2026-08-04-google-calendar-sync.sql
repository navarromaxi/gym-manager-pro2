-- Sincronización de turnos de rutina online con Google Calendar.
-- Es seguro para los gimnasios existentes: sólo agrega una referencia opcional
-- a los turnos del servicio de entrenamiento online.

alter table public.online_training_appointments
  add column if not exists google_calendar_event_id text;

create unique index if not exists online_training_appointments_google_calendar_event_id_key
  on public.online_training_appointments (google_calendar_event_id)
  where google_calendar_event_id is not null;
