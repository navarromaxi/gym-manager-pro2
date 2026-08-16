-- Clases puntuales y suspensión de una ocurrencia semanal concreta.
alter table public.class_occurrences
  alter column template_id drop not null;

alter table public.class_occurrences
  add column if not exists is_cancelled boolean not null default false;

create index if not exists class_occurrences_active_index
  on public.class_occurrences (gym_id, starts_at)
  where is_cancelled = false;
