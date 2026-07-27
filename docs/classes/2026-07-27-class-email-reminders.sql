-- Recordatorios por email para reservas de Clases.
-- Ejecutar una sola vez después de los scripts anteriores de docs/classes.
-- Guarda solamente la marca técnica de que un recordatorio fue enviado.

create table if not exists public.class_reservation_reminders (
  occurrence_id uuid not null references public.class_occurrences(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  reminder_type text not null default 'upcoming_class',
  sent_at timestamptz not null default now(),
  primary key (occurrence_id, member_id, reminder_type)
);

alter table public.class_reservation_reminders enable row level security;

create index if not exists class_reservation_reminders_occurrence_index
  on public.class_reservation_reminders (occurrence_id);
