-- Planificación semanal para Rutinas personalizadas.
-- Ejecutar una sola vez después de 2026-07-28-link-routines-to-members.sql.
-- No modifica ni elimina las rutinas ya existentes.

alter table public.routines
  add column if not exists weekly_plan jsonb not null default '{}'::jsonb;
