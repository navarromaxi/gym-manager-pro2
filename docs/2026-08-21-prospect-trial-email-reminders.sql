-- Registra la fecha y hora específica para la que se envió el email.
-- Si la clase se reprograma, la nueva combinación vuelve a ser elegible.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS trial_email_reminder_sent_for text;
