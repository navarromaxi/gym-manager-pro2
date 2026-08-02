-- PORTAL PRIVADO DE ENTRENAMIENTO
-- Paso previo: crear en Supabase > Authentication > Users un usuario para el
-- profesor, con email, contraseña y "Auto Confirm User" activado.
-- Copiar el UUID de ese usuario y reemplazar PROFESOR_AUTH_UUID abajo.
--
-- Este registro interno no se muestra como una opción a los gimnasios
-- existentes. Sólo da acceso a /gestion-entrenamiento a esa cuenta.

-- La columna password es heredada de un esquema anterior. La autenticación
-- real se hace exclusivamente con Supabase Auth; este valor no es una clave
-- utilizable ni debe coincidir con la contraseña del profesor.
insert into public.gyms (id, name, username, password, user_id, subscription)
values (
  'entrenamiento_online',
  'Entrenamiento online',
  'entrenamiento_online',
  'managed_by_supabase_auth_only',
  '04d4cd02-72aa-403a-b3c3-c372079077be',
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  username = excluded.username,
  password = excluded.password,
  user_id = excluded.user_id,
  subscription = excluded.subscription;

-- Antes de lanzar, reemplazar PAYMENT_SUBSCRIPTION_URL por el enlace real
-- de suscripción de Mercado Pago y confirmar el WhatsApp.
insert into public.online_training_config (
  gym_id,
  is_enabled,
  monthly_price,
  payment_url,
  whatsapp_url
)
values (
  'entrenamiento_online',
  true,
  549,
  'https://mpago.la/1W1j55z',
  'https://wa.me/59897323916'
)
on conflict (gym_id) do update set
  is_enabled = excluded.is_enabled,
  monthly_price = excluded.monthly_price,
  payment_url = excluded.payment_url,
  whatsapp_url = excluded.whatsapp_url;

-- Asocia el gym interno al JWT de esta cuenta. Es lo que hace que las
-- políticas RLS le permitan ver exclusivamente este portal.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('gym_id', 'entrenamiento_online')
where id = '04d4cd02-72aa-403a-b3c3-c372079077be';
