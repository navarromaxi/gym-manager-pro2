# Puesta en marcha: acceso facial Fusionar

Este módulo no se activa para ningún gimnasio por defecto. Los gimnasios actuales
siguen usando el acceso habitual y nunca ven el panel de Fusionar.

## Datos que hay que pedir a Fusionar

Antes de activar el cliente real, confirmar con su soporte:

1. La URL **HTTPS de producción** de su API. La URL publicada en la
   documentación actual no resuelve desde Internet, por lo que este dato sigue
   siendo imprescindible.
2. La cuenta API y el ID del acceso ya fueron recibidos por canal privado. Se
   deben cargar como secreto de Vercel, nunca en este repositorio.
3. Que el alta presencial de rostro en el terminal RF-2002F4 queda vinculada al
   funcionario creado por API mediante la cédula (`Documento`) o mediante el
   `IdFuncionario` retornado por la API.
4. Que `/marcas` devuelve, para cada marca, el identificador del acceso
   (`IdAcceso`, o indicar el nombre exacto del campo) y cuál corresponde al
   molinete contratado. Sin este dato el sistema bloquea la importación para
   no mezclar registros de otros accesos.

## Configuración privada en Vercel

Crear o actualizar la variable sensible `FUSIONAR_CREDENTIALS_JSON` sólo en
Production. Su formato es:

```json
{
  "ID_DEL_GIMNASIO": {
    "apiKey": "ENTREGADA_POR_FUSIONAR",
    "secretKey": "ENTREGADA_POR_FUSIONAR",
    "baseUrl": "https://api-produccion-confirmada-por-fusionar"
  }
}
```

Nunca guardar estas claves en Supabase, el código ni Git.

## Activación en Supabase

Reemplazar `ID_DEL_GIMNASIO` y ejecutar cuando el gimnasio ya exista:

```sql
update public.gyms
set uses_facial_access = true
where id = 'ID_DEL_GIMNASIO';

insert into public.fusionar_integration_configs (
  gym_id,
  is_enabled,
  api_base_url,
  access_id
)
values (
  'ID_DEL_GIMNASIO',
  true,
   'https://api-produccion-confirmada-por-fusionar',
   'ID_DEL_MOLINETE_CONFIRMADO_POR_FUSIONAR'
)
on conflict (gym_id) do update set
  is_enabled = excluded.is_enabled,
  api_base_url = excluded.api_base_url,
  access_id = excluded.access_id,
  updated_at = now();
```

## Primera prueba controlada

1. Ingresar al sistema con la cuenta de ese gimnasio y abrir **Accesos**.
2. En el panel privado **Acceso facial conectado**, usar **Probar conexión**.
3. Cargar un socio de prueba con cédula y vencimiento vigente.
4. Usar **Sincronizar socios**. El socio queda pendiente de enrolamiento facial.
5. El técnico registra el rostro presencialmente en el equipo Fusionar.
6. Realizar una pasada de prueba por el molinete.
7. Usar **Importar accesos** y verificar que aparezca un solo registro de acceso.

La importación evita duplicados aunque se ejecute más de una vez.

## Operación inicial

Al principio se usa el botón de sincronización manual. Es deliberado: permite
validar los nombres reales de campos y marcas que devuelva el terminal antes de
automatizarlo. Una vez confirmada una pasada real, se puede programar la
sincronización periódica sin tocar a los demás gimnasios.
