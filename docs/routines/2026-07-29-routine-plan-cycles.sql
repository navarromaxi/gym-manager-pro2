-- Ciclo de planificación de rutinas personalizadas.
-- weekly: 1 semana, biweekly: 2 semanas, monthly: 4 semanas.
-- cycle_plan guarda bloques por semana y día; no altera weekly_plan existente.

alter table public.routines
  add column if not exists plan_cycle text not null default 'weekly',
  add column if not exists cycle_plan jsonb not null default '{}'::jsonb;

alter table public.routines
  drop constraint if exists routines_plan_cycle_check;

alter table public.routines
  add constraint routines_plan_cycle_check
  check (plan_cycle in ('weekly', 'biweekly', 'monthly'));
