-- NUEVA FUNCIÓN: Clases semanales. No modifica Eventos, class_sessions ni class_registrations.
-- Ejecutar una sola vez en Supabase SQL Editor, antes de publicar la interfaz de Clases.

create table if not exists public.class_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  title text not null,
  weekday smallint not null check (weekday between 1 and 7), -- 1=Lunes, 7=Domingo
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  capacity integer not null check (capacity > 0),
  notes text,
  timezone text not null default 'America/Montevideo',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_occurrences (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.class_templates(id) on delete cascade,
  gym_id text not null references public.gyms(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (template_id, starts_at),
  check (ends_at > starts_at)
);

create table if not exists public.class_reservations (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.class_occurrences(id) on delete cascade,
  gym_id text not null references public.gyms(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (occurrence_id, member_id)
);

-- Se conservan sólo estos resúmenes mensuales; las reservas individuales se eliminan al cerrar cada clase.
create table if not exists public.member_class_monthly_stats (
  gym_id text not null references public.gyms(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  month date not null,
  reservations_count integer not null default 0 check (reservations_count >= 0),
  primary key (gym_id, member_id, month)
);

create table if not exists public.class_template_monthly_stats (
  gym_id text not null references public.gyms(id) on delete cascade,
  template_id uuid not null references public.class_templates(id) on delete cascade,
  month date not null,
  reservations_count integer not null default 0 check (reservations_count >= 0),
  primary key (gym_id, template_id, month)
);

create index if not exists class_occurrences_public_index on public.class_occurrences (gym_id, starts_at);
create index if not exists class_reservations_occurrence_index on public.class_reservations (occurrence_id);

alter table public.class_templates enable row level security;
alter table public.class_occurrences enable row level security;
alter table public.class_reservations enable row level security;
alter table public.member_class_monthly_stats enable row level security;
alter table public.class_template_monthly_stats enable row level security;

create policy "gym manages own class templates" on public.class_templates for all to authenticated
  using (exists (select 1 from public.gyms g where g.id = class_templates.gym_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.gyms g where g.id = class_templates.gym_id and g.user_id = auth.uid()));
create policy "gym reads own class occurrences" on public.class_occurrences for select to authenticated
  using (exists (select 1 from public.gyms g where g.id = class_occurrences.gym_id and g.user_id = auth.uid()));
create policy "gym reads own class reservations" on public.class_reservations for select to authenticated
  using (exists (select 1 from public.gyms g where g.id = class_reservations.gym_id and g.user_id = auth.uid()));
create policy "gym reads own member class stats" on public.member_class_monthly_stats for select to authenticated
  using (exists (select 1 from public.gyms g where g.id = member_class_monthly_stats.gym_id and g.user_id = auth.uid()));
create policy "gym reads own class template stats" on public.class_template_monthly_stats for select to authenticated
  using (exists (select 1 from public.gyms g where g.id = class_template_monthly_stats.gym_id and g.user_id = auth.uid()));

-- Genera ocurrencias de los próximos ocho días. La automatización llamará esta función periódicamente.
create or replace function public.generate_upcoming_class_occurrences(days_ahead integer default 8)
returns void language plpgsql security definer set search_path = public as $$
declare template_row record; candidate_date date; start_at timestamptz;
begin
  for template_row in select * from public.class_templates where is_active loop
    for candidate_date in select generate_series(current_date, current_date + greatest(days_ahead, 1), interval '1 day')::date loop
      if extract(isodow from candidate_date) = template_row.weekday then
        start_at := ((candidate_date + template_row.start_time) at time zone template_row.timezone);
        insert into public.class_occurrences (template_id, gym_id, title, starts_at, ends_at, capacity, notes)
        values (template_row.id, template_row.gym_id, template_row.title, start_at,
          start_at + make_interval(mins => template_row.duration_minutes), template_row.capacity, template_row.notes)
        on conflict (template_id, starts_at) do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

-- Cierra clases terminadas hace dos horas: acumula contadores y elimina sólo reservas individuales.
create or replace function public.finalize_expired_class_occurrences()
returns void language plpgsql security definer set search_path = public as $$
declare occurrence_row record; month_start date;
begin
  for occurrence_row in select * from public.class_occurrences where ends_at <= now() - interval '2 hours' for update skip locked loop
    month_start := date_trunc('month', occurrence_row.starts_at at time zone 'America/Montevideo')::date;
    insert into public.member_class_monthly_stats (gym_id, member_id, month, reservations_count)
      select gym_id, member_id, month_start, count(*) from public.class_reservations where occurrence_id = occurrence_row.id group by gym_id, member_id
      on conflict (gym_id, member_id, month) do update set reservations_count = member_class_monthly_stats.reservations_count + excluded.reservations_count;
    insert into public.class_template_monthly_stats (gym_id, template_id, month, reservations_count)
      select occurrence_row.gym_id, occurrence_row.template_id, month_start, count(*) from public.class_reservations where occurrence_id = occurrence_row.id
      on conflict (gym_id, template_id, month) do update set reservations_count = class_template_monthly_stats.reservations_count + excluded.reservations_count;
    delete from public.class_occurrences where id = occurrence_row.id;
  end loop;
end;
$$;
