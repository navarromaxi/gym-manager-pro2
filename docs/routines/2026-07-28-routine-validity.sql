-- Vigencia de rutinas personalizadas.
-- NULL significa: comienza inmediatamente / no tiene fecha de finalización.
-- Las rutinas vencidas se conservan como historial; no se eliminan.

alter table public.routines
  add column if not exists valid_from date,
  add column if not exists valid_until date;

alter table public.routines
  drop constraint if exists routines_validity_dates_check;

alter table public.routines
  add constraint routines_validity_dates_check
  check (valid_until is null or valid_from is null or valid_until >= valid_from);

create index if not exists routines_gym_member_validity_idx
  on public.routines (gym_id, member_id, valid_from, valid_until);
