-- Ejecutar en Supabase SQL Editor. Devuelve los datos mínimos necesarios para
-- enviar la confirmación luego de crear una reserva de clase.
create or replace function public.reserve_class_occurrence(
  p_gym_id text,
  p_occurrence_id uuid,
  p_cedula text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare occurrence_row public.class_occurrences%rowtype; member_row public.members%rowtype;
declare normalized_cedula text; reservation_count integer;
begin
  normalized_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  if normalized_cedula = '' then return jsonb_build_object('ok', false, 'code', 'invalid_cedula'); end if;

  select * into occurrence_row from public.class_occurrences where id = p_occurrence_id and gym_id = p_gym_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'unavailable'); end if;
  if occurrence_row.starts_at <= now() then return jsonb_build_object('ok', false, 'code', 'started'); end if;

  select * into member_row from public.members
    where gym_id = p_gym_id and regexp_replace(coalesce(cedula, ''), '\D', '', 'g') = normalized_cedula and next_payment >= current_date
    limit 1;
  if not found then return jsonb_build_object('ok', false, 'code', 'member_not_active'); end if;
  if exists (select 1 from public.class_reservations where occurrence_id = occurrence_row.id and member_id = member_row.id) then return jsonb_build_object('ok', false, 'code', 'already_reserved'); end if;
  select count(*) into reservation_count from public.class_reservations where occurrence_id = occurrence_row.id;
  if reservation_count >= occurrence_row.capacity then return jsonb_build_object('ok', false, 'code', 'full'); end if;

  insert into public.class_reservations (occurrence_id, gym_id, member_id) values (occurrence_row.id, p_gym_id, member_row.id);
  return jsonb_build_object('ok', true, 'member_name', member_row.name, 'member_email', member_row.email, 'next_payment', member_row.next_payment);
end;
$$;

revoke all on function public.reserve_class_occurrence(text, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_class_occurrence(text, uuid, text) to service_role;
