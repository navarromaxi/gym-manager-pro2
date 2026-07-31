-- Intensidad visual por día para las rutinas personalizadas.
-- Valores usados por la aplicación: green, yellow, red.

alter table public.routines
  add column if not exists day_intensities jsonb not null default '{}'::jsonb;
