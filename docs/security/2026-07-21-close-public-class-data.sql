-- Paso de seguridad 2: clases y reservas públicas
--
-- Requisito: debe estar desplegada la ruta
-- /api/public-gyms/:gymId/class-sessions. La pantalla pública ya la utiliza.
--
-- Este script cierra el acceso directo desde el navegador a estas tablas.
-- La reserva pública continúa funcionando mediante la API del servidor, que
-- sólo entrega clases y cupos, nunca datos personales de inscriptos.

begin;

-- Estas reglas usan la relación real usuario autenticado -> gyms.user_id.
-- No dependen de gym_id guardado en el JWT.
drop policy if exists "gym owners manage class sessions" on public.class_sessions;
create policy "gym owners manage class sessions"
  on public.class_sessions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.gyms g
      where g.id = class_sessions.gym_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = class_sessions.gym_id
        and g.user_id = auth.uid()
    )
  );

drop policy if exists "gym owners manage class registrations" on public.class_registrations;
create policy "gym owners manage class registrations"
  on public.class_registrations
  for all
  to authenticated
  using (
    exists (
      select 1 from public.gyms g
      where g.id = class_registrations.gym_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = class_registrations.gym_id
        and g.user_id = auth.uid()
    )
  );

-- Eliminamos las reglas anteriores después de crear las nuevas, por lo que no
-- hay una ventana sin acceso para el administrador autenticado.
drop policy if exists "admins manage sessions" on public.class_sessions;
drop policy if exists "admins select sessions" on public.class_sessions;
drop policy if exists "public puede ver clases" on public.class_sessions;

drop policy if exists "admins manage registrations" on public.class_registrations;
drop policy if exists "admins select registrations" on public.class_registrations;
drop policy if exists "public puede crear inscripciones" on public.class_registrations;
drop policy if exists "public puede ver inscripciones" on public.class_registrations;

commit;

-- Verificación posterior (sólo lectura):
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('class_sessions', 'class_registrations')
-- order by tablename, policyname;

-- REVERSIÓN DE EMERGENCIA (no ejecutar salvo que sea necesario):
-- create policy "public puede ver clases"
--   on public.class_sessions for select to public using (true);
-- create policy "public puede ver inscripciones"
--   on public.class_registrations for select to public using (true);
