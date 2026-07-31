-- Enlace público individual para compartir una rutina sin exponer IDs, socios ni gimnasios.

alter table public.routines
  add column if not exists public_share_token uuid,
  add column if not exists public_link_enabled boolean not null default true;

update public.routines
set public_share_token = gen_random_uuid()
where public_share_token is null;

alter table public.routines
  alter column public_share_token set default gen_random_uuid(),
  alter column public_share_token set not null;

create unique index if not exists routines_public_share_token_key
  on public.routines (public_share_token);
