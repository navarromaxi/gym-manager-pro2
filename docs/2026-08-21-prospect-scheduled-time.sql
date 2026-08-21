-- Hora de la clase de prueba coordinada para cada lead.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS scheduled_time time without time zone;
