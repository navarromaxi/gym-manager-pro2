-- Portal público de reservas de Clases.
-- Ejecutar una sola vez después de los dos scripts anteriores de docs/classes.
-- No modifica Eventos, Socios ni Pagos.

create or replace function public.get_my_class_reservations(
  p_gym_id text,
  p_cedula text
) returns table (
  occurrence_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  notes text
)
language plpgsql security definer set search_path = public as $$
declare
  normalized_cedula text;
  current_member_id text;
begin
  normalized_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  if normalized_cedula = '' then return; end if;

  select id into current_member_id
  from public.members
  where gym_id = p_gym_id
    and regexp_replace(coalesce(cedula, ''), '\D', '', 'g') = normalized_cedula
  limit 1;
  if current_member_id is null then return; end if;

  return query
  select o.id, o.title, o.starts_at, o.ends_at, o.capacity, o.notes
  from public.class_reservations r
  join public.class_occurrences o on o.id = r.occurrence_id
  where r.gym_id = p_gym_id
    and r.member_id = current_member_id
    and o.starts_at > now()
  order by o.starts_at;
end;
$$;

create or replace function public.cancel_my_class_reservation(
  p_gym_id text,
  p_occurrence_id uuid,
  p_cedula text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  normalized_cedula text;
  current_member_id text;
  occurrence_start timestamptz;
begin
  normalized_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  if normalized_cedula = '' then return jsonb_build_object('ok', false, 'code', 'invalid_cedula'); end if;

  select id into current_member_id
  from public.members
  where gym_id = p_gym_id
    and regexp_replace(coalesce(cedula, ''), '\D', '', 'g') = normalized_cedula
  limit 1;
  if current_member_id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  select o.starts_at into occurrence_start
  from public.class_reservations r
  join public.class_occurrences o on o.id = r.occurrence_id
  where r.gym_id = p_gym_id
    and r.member_id = current_member_id
    and r.occurrence_id = p_occurrence_id
  for update of r;
  if occurrence_start is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if occurrence_start <= now() + interval '1 hour' then return jsonb_build_object('ok', false, 'code', 'too_late'); end if;

  delete from public.class_reservations
  where gym_id = p_gym_id
    and member_id = current_member_id
    and occurrence_id = p_occurrence_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_my_class_reservations(text, text) from public, anon, authenticated;
revoke all on function public.cancel_my_class_reservation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_class_reservations(text, text) to service_role;
grant execute on function public.cancel_my_class_reservation(text, uuid, text) to service_role;
