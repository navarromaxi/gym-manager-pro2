-- Ciclo de vida de rutinas personalizadas.
-- Una rutina se archiva luego de 3 meses sin abrirse en modo sala
-- y se elimina definitivamente 30 días después de archivarse.

alter table public.routines
  add column if not exists last_opened_at timestamptz,
  add column if not exists archived_at timestamptz;

create index if not exists routines_active_lifecycle_idx
  on public.routines (archived_at, last_opened_at)
  where member_id is not null;
