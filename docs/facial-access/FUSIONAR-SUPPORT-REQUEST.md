# Solicitud técnica pendiente para Fusionar

Asunto: URL de producción y prueba de integración FSClock

Hola, equipo de Fusionar:

Ya recibimos la cuenta API y el ID de acceso por canal privado. Nuestro sistema
crea o actualiza funcionarios mediante `Documento`, les asigna el acceso
indicado y consulta las marcas con `GET /marcas/acceso` filtrando por
`IdAcceso`.

Para completar la puesta en marcha necesitamos por favor:

1. La URL **HTTPS pública de producción** de FSClock. La URL de ejemplo de la
   documentación (`backend.fsclock.caiqui`) no resuelve desde Internet.
2. Confirmación de que un funcionario creado/actualizado por API con
   `Accesos: [{ IdAcceso: ... }]`, `Activo: true` y `VigenciaHasta` vigente
   queda habilitado en el RF-2002F4 asociado a ese acceso.
3. El procedimiento para enrolar presencialmente el rostro del funcionario ya
   creado por API, idealmente usando el documento o su `IdFuncionario`.
4. Una ventana de prueba o un funcionario de prueba para verificar: login API,
   alta/actualización, enrolamiento facial, apertura del molinete y lectura de
   su marca en `/marcas/acceso`.
5. Confirmación de la zona horaria con que devuelve `FechaHora` y si el token
   de login tiene vencimiento o límite de solicitudes.

No enviar credenciales por este hilo; las administramos como secretos del
servidor.
