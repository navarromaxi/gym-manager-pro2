-- Modo sala de Rutinas.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No borra ni modifica las rutinas existentes: simplemente permite asignarlas a un socio.

alter table public.routines
  add column if not exists member_id text references public.members(id) on delete set null;

create index if not exists routines_gym_member_index
  on public.routines (gym_id, member_id)
  where member_id is not null;
