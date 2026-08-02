-- CLIENTES FINALES / RUTINAS ONLINE
-- Ejecutar una única vez en Supabase SQL Editor.
-- Esta capa queda separada de los socios y pagos que ya usan los gimnasios.

create table if not exists public.online_training_config (
  gym_id text primary key references public.gyms(id) on delete cascade,
  is_enabled boolean not null default false,
  monthly_price integer not null default 549 check (monthly_price > 0),
  payment_url text,
  whatsapp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_training_clients (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 1),
  cedula text not null,
  email text not null,
  phone text,
  source text not null default 'Otro' check (source in ('Redes sociales PymesSistemas', 'Influencers', 'Otro')),
  source_detail text,
  intake jsonb not null default '{}'::jsonb,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'payment_due', 'grace', 'expired', 'cancelled')),
  subscription_started_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  mercado_pago_subscription_id text,
  mercado_pago_payer_id text,
  last_payment_at timestamptz,
  linked_member_id text references public.members(id) on delete set null,
  linked_routine_id text references public.routines(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, cedula)
);

create index if not exists online_training_clients_gym_status_index
  on public.online_training_clients (gym_id, status, created_at desc);
create index if not exists online_training_clients_gym_period_index
  on public.online_training_clients (gym_id, current_period_ends_at);

alter table public.online_training_config enable row level security;
alter table public.online_training_clients enable row level security;

drop policy if exists "online training config own gym" on public.online_training_config;
create policy "online training config own gym"
  on public.online_training_config for all to authenticated
  using (gym_id = public.gym_id_from_jwt())
  with check (gym_id = public.gym_id_from_jwt());

drop policy if exists "online training clients own gym" on public.online_training_clients;
create policy "online training clients own gym"
  on public.online_training_clients for all to authenticated
  using (gym_id = public.gym_id_from_jwt())
  with check (gym_id = public.gym_id_from_jwt());

create or replace function public.online_training_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists online_training_config_updated_at on public.online_training_config;
create trigger online_training_config_updated_at
  before update on public.online_training_config
  for each row execute function public.online_training_set_updated_at();

drop trigger if exists online_training_clients_updated_at on public.online_training_clients;
create trigger online_training_clients_updated_at
  before update on public.online_training_clients
  for each row execute function public.online_training_set_updated_at();

-- Registro público: no da acceso a datos privados, sólo crea una solicitud
-- cuando el servicio está habilitado por el administrador de ese gym.
create or replace function public.submit_online_training_intake(
  p_gym_id text,
  p_full_name text,
  p_cedula text,
  p_email text,
  p_phone text,
  p_source text,
  p_source_detail text,
  p_intake jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare client_id uuid;
begin
  if not exists (
    select 1 from public.online_training_config
    where gym_id = p_gym_id and is_enabled = true
  ) then
    raise exception 'online_training_not_available';
  end if;

  insert into public.online_training_clients (
    gym_id, full_name, cedula, email, phone, source, source_detail, intake
  ) values (
    p_gym_id,
    trim(p_full_name),
    trim(p_cedula),
    lower(trim(p_email)),
    nullif(trim(p_phone), ''),
    case when p_source in ('Redes sociales PymesSistemas', 'Influencers', 'Otro') then p_source else 'Otro' end,
    nullif(trim(p_source_detail), ''),
    coalesce(p_intake, '{}'::jsonb)
  )
  on conflict (gym_id, cedula) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    source = excluded.source,
    source_detail = excluded.source_detail,
    intake = excluded.intake,
    status = case
      when public.online_training_clients.status in ('expired', 'cancelled') then 'pending_payment'
      else public.online_training_clients.status
    end,
    updated_at = now()
  returning id into client_id;

  return client_id;
end;
$$;

grant execute on function public.submit_online_training_intake(text, text, text, text, text, text, text, jsonb) to anon, authenticated;

-- Datos mínimos para la pantalla pública. No expone clientes ni información
-- interna del gimnasio.
create or replace function public.get_online_training_public_config(p_gym_id text)
returns table (
  monthly_price integer,
  payment_url text,
  whatsapp_url text
) language sql security definer set search_path = public as $$
  select c.monthly_price, c.payment_url, c.whatsapp_url
  from public.online_training_config c
  where c.gym_id = p_gym_id
    and c.is_enabled = true
  limit 1;
$$;

grant execute on function public.get_online_training_public_config(text) to anon, authenticated;
