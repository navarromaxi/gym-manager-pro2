-- Hora de la clase de prueba coordinada para cada lead.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS scheduled_time time without time zone;

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_for text;
