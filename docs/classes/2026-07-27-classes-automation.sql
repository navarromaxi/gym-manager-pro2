-- Automatización de Clases: ejecuta una sola vez después de los scripts anteriores.
-- Mantiene disponibles los próximos 8 días y resume/elimina reservas individuales
-- dos horas después de cada clase.

create extension if not exists pg_cron;

-- Si este script se vuelve a ejecutar, reemplaza los trabajos anteriores sin duplicarlos.
select cron.unschedule(jobid)
from cron.job
where jobname in ('classes-generate-upcoming', 'classes-finalize-expired');

select cron.schedule(
  'classes-generate-upcoming',
  '15 * * * *',
  $$select public.generate_upcoming_class_occurrences(8);$$
);

select cron.schedule(
  'classes-finalize-expired',
  '*/15 * * * *',
  $$select public.finalize_expired_class_occurrences();$$
);
