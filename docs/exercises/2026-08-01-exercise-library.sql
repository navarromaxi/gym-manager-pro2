-- Biblioteca privada de ejercicios por gimnasio.
-- Cada gimnasio puede reutilizar sus ejercicios, indicaciones y videos
-- al crear rutinas sin compartirlos con otros gimnasios.

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  category text not null default 'General',
  muscle_group text,
  equipment text,
  instructions text,
  video_url text,
  default_sets integer,
  default_reps text,
  default_weight text,
  default_rest text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_library_gym_active_name_idx
  on public.exercise_library (gym_id, is_active, name);

alter table public.exercise_library enable row level security;

drop policy if exists "exercise library gym access" on public.exercise_library;

create policy "exercise library gym access"
  on public.exercise_library
  for all
  to authenticated
  using (gym_id = public.gym_id_from_jwt())
  with check (gym_id = public.gym_id_from_jwt());
