-- INTEGRACION DE ACCESO FACIAL / FUSIONAR
--
-- Esta migracion es segura para los gimnasios ya existentes:
-- - Todos quedan con uses_facial_access = false.
-- - Solo el gimnasio que se habilite expresamente vera y podra usar la integracion.
-- - No guarda apiKey ni secretKey de Fusionar. Esas credenciales van solamente
--   como secreto del servidor en Vercel.

alter table public.gyms
  add column if not exists uses_facial_access boolean not null default false;

create table if not exists public.fusionar_integration_configs (
  gym_id text primary key references public.gyms(id) on delete cascade,
  provider text not null default 'fusionar' check (provider = 'fusionar'),
  is_enabled boolean not null default false,
  api_base_url text null,
  access_id text null,
  last_member_sync_at timestamptz null,
  last_access_sync_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fusionar_member_links (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  normalized_cedula text not null,
  fusionar_employee_id text null,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'error', 'manual_enrollment_pending')),
  face_enrollment_status text not null default 'unknown'
    check (face_enrollment_status in ('unknown', 'pending', 'enrolled', 'not_required')),
  last_synced_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, member_id),
  unique (gym_id, normalized_cedula)
);

create index if not exists fusionar_member_links_gym_sync_status_idx
  on public.fusionar_member_links (gym_id, sync_status, updated_at desc);

create table if not exists public.fusionar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.gyms(id) on delete cascade,
  run_type text not null check (run_type in ('members', 'accesses', 'connection_check')),
  status text not null check (status in ('started', 'success', 'partial', 'error')),
  processed_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists fusionar_sync_runs_gym_started_at_idx
  on public.fusionar_sync_runs (gym_id, started_at desc);

-- La importacion de marcas externas puede convivir con los accesos del kiosco.
-- No modifica reportes existentes; agrega el origen y el id externo para evitar
-- duplicados cuando se ejecute una sincronizacion mas de una vez.
alter table public.member_access_logs
  add column if not exists source text not null default 'manual_kiosk'
    check (source in ('manual_kiosk', 'fusionar_facial')),
  add column if not exists external_event_id text null;

create unique index if not exists member_access_logs_fusionar_external_event_idx
  on public.member_access_logs (gym_id, source, external_event_id)
  where external_event_id is not null;

alter table public.fusionar_integration_configs enable row level security;
alter table public.fusionar_member_links enable row level security;
alter table public.fusionar_sync_runs enable row level security;

-- Estas tablas se administran exclusivamente por endpoints del servidor con
-- service_role. No se abre ningun permiso directo al navegador.

-- EJEMPLO PARA HABILITAR EL CLIENTE REAL (reemplazar CLIENTE_GYM_ID):
-- update public.gyms set uses_facial_access = true where id = 'CLIENTE_GYM_ID';
-- insert into public.fusionar_integration_configs (gym_id, is_enabled, api_base_url, access_id)
-- values (
--   'CLIENTE_GYM_ID',
--   true,
--   'https://HOST_PRODUCCION_CONFIRMADO_POR_FUSIONAR',
--   'ID_DEL_MOLINETE_CONFIRMADO_POR_FUSIONAR'
-- )
-- on conflict (gym_id) do update set is_enabled = excluded.is_enabled,
--   api_base_url = excluded.api_base_url, updated_at = now();
