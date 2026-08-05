-- AVISOS RECURRENTES DE RUTINA ONLINE
-- Ejecutar una única vez. Permite enviar los mismos avisos en cada mes
-- de suscripción, en lugar de una sola vez por cliente.
-- No modifica ninguna tabla ni dato de los gimnasios existentes.

alter table public.online_training_notifications
  add column if not exists period_ends_at timestamptz;

alter table public.online_training_notifications
  drop constraint if exists online_training_notifications_client_id_notification_type_key;

create unique index if not exists online_training_notifications_unique_period
  on public.online_training_notifications (client_id, notification_type, period_ends_at);
