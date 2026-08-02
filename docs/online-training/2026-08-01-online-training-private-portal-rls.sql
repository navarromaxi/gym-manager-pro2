-- AJUSTE DE SEGURIDAD DEL PORTAL PRIVADO DE ENTRENAMIENTO
-- Ejecutar una vez. Sólo modifica las políticas de las dos tablas nuevas
-- de entrenamiento online; no toca las RLS ni los datos de los gimnasios.
--
-- En vez de depender de un dato dentro del JWT, valida que el usuario de
-- Supabase sea dueño del registro interno de gyms correspondiente.

drop policy if exists "online training config own gym" on public.online_training_config;
create policy "online training config own gym"
  on public.online_training_config for all to authenticated
  using (
    exists (
      select 1 from public.gyms g
      where g.id = online_training_config.gym_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = online_training_config.gym_id
        and g.user_id = auth.uid()
    )
  );

drop policy if exists "online training clients own gym" on public.online_training_clients;
create policy "online training clients own gym"
  on public.online_training_clients for all to authenticated
  using (
    exists (
      select 1 from public.gyms g
      where g.id = online_training_clients.gym_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = online_training_clients.gym_id
        and g.user_id = auth.uid()
    )
  );
