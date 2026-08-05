-- AVISOS AUTOMÁTICOS DEL SERVICIO DE RUTINA ONLINE
-- Ejecutar una única vez en Supabase SQL Editor.
-- Agrega los avisos de pago confirmado y de entrevista sin tocar los datos
-- ni las políticas de los gimnasios existentes.

alter table public.online_training_notifications
  add column if not exists period_ends_at timestamptz;

alter table public.online_training_notifications
  drop constraint if exists online_training_notifications_client_id_notification_type_key;

alter table public.online_training_notifications
  drop constraint if exists online_training_notifications_notification_type_check;

alter table public.online_training_notifications
  add constraint online_training_notifications_notification_type_check
  check (notification_type in (
    'renewal_reminder',
    'period_ended',
    'service_expired',
    'payment_confirmed',
    'appointment_confirmed',
    'appointment_reminder'
  ));

create unique index if not exists online_training_notifications_unique_period
  on public.online_training_notifications (client_id, notification_type, period_ends_at);
