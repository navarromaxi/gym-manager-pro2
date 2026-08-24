# Mapa de archivos · ManagerPro 2.0

Guía rápida para ubicar cada parte del sistema antes de modificar código. Este documento describe la estructura vigente y no debe contener claves, tokens ni datos de producción.

## Raíz del proyecto

| Ruta | Propósito |
| --- | --- |
| `app/` | Páginas, rutas públicas y endpoints de la aplicación Next.js. |
| `components/` | Módulos visuales y lógica de interfaz del panel administrativo. |
| `features/` | Funcionalidades complejas organizadas por dominio, principalmente dashboard, reportes y rutinas. |
| `lib/` | Clientes de Supabase, utilidades, integraciones y funciones compartidas. |
| `docs/` | Migraciones SQL, notas de implementación y documentación técnica. |
| `public/` | Recursos estáticos y manuales accesibles desde la aplicación. |
| `scripts/` | Scripts de soporte y mantenimiento. |
| `styles/` | Estilos compartidos adicionales. |
| `.env.local` | Variables locales. Nunca se sube a GitHub. |
| `vercel.json` | Configuración de Vercel y tareas programadas. |

## Páginas, portales y APIs (`app/`)

| Ruta | Función |
| --- | --- |
| `app/page.tsx` | Panel administrativo principal y navegación entre módulos. |
| `app/acceso/[gymId]/page.tsx` | Pantalla pública de control de acceso por cédula. |
| `app/clases/` | Pantallas públicas vinculadas a clases y reservas. |
| `app/inscripciones/` | Flujos públicos de inscripción o reserva. |
| `app/rutina/[token]/page.tsx` | Rutina pública compartible con cada socio. |
| `app/rutina-personalizada.html` | Vista pública alternativa de rutina. |
| `app/sala/` y `app/sala-admin/` | Pantallas de apoyo para el modo sala. |
| `app/entrenamiento/` y `app/gestion-entrenamiento/` | Funciones de entrenamiento online y gestión asociada. |
| `app/api/` | Endpoints del sistema: pagos, socios, clases, accesos, facturas, cron e integraciones. |

### Endpoints importantes

| Ruta | Función |
| --- | --- |
| `app/api/cron/prospect-trial-reminders/route.ts` | Envía recordatorios de clases de prueba para el día siguiente. Se ejecuta diariamente a las 14:00 de Uruguay mediante Vercel. |
| `app/api/cron/routine-cleanup/` | Limpieza programada de información de rutinas. |
| `app/api/cron/online-training-reminders/` | Recordatorios vinculados a entrenamiento online. |
| `app/api/cron/facial-access-sync/` | Sincronización de acceso con la integración configurada. |
| `app/api/invoices/route.ts` | Emisión y consulta de facturas. |

## Módulos del panel (`components/`)

| Archivo | Módulo |
| --- | --- |
| `member-management.tsx` y `member-management-supabase.tsx` | Socios, altas, edición y estados. |
| `payment-management.tsx` | Pagos y renovaciones. |
| `prospect-management.tsx` | Leads, seguimiento, clases de prueba y conversión a socio. |
| `inactive-management.tsx` | Socios inactivos. |
| `plan-management.tsx` | Planes base. |
| `custom-plan-management.tsx` | Planes complementarios o personalizados. |
| `one-time-payment-management.tsx` | Pagos únicos. |
| `class-management.tsx` | Clases semanales y cupos. |
| `class-registration-management.tsx` | Eventos, sesiones y reservas. |
| `exercise-library-management.tsx` | Biblioteca de ejercicios. |
| `routine-management.tsx` | Rutinas generales, personalizadas y enlaces públicos. |
| `activity-management.tsx` | Actividades del gimnasio. |
| `expense-management.tsx` | Gastos y categorías. |
| `reports-section.tsx` | Reportes y estadísticas. |
| `invoice-management.tsx` | Consulta de facturas. |
| `fusionar-access-panel.tsx` | Gestión de la integración de acceso. |
| `online-training-management.tsx` | Operación de entrenamiento online. |

## Dominios especializados (`features/`)

| Ruta | Función |
| --- | --- |
| `features/dashboard/` | Componentes y métricas del dashboard. |
| `features/reports/` | Tarjetas, filtros y cálculos de reportes. |
| `features/routines/` | Modelos, componentes y modo sala de rutinas. |

## Servicios e integraciones (`lib/`)

| Archivo | Función |
| --- | --- |
| `supabase.ts` | Cliente y tipos compartidos de Supabase para el navegador. |
| `supabase-server.ts` | Cliente de Supabase del lado servidor. |
| `queries.ts` | Consultas reutilizables. |
| `google-calendar.ts` | Integración con Google Calendar. |
| `invoice-pdf.ts` y `manual-invoice-pdf.ts` | Generación de comprobantes PDF. |
| `member-access.ts` | Lógica de control de acceso. |
| `online-training-links.ts` | Enlaces y accesos de entrenamiento online. |
| `authenticated-fetch.ts` y `api-auth.ts` | Llamadas autenticadas y utilidades de seguridad. |

## Base de datos y migraciones (`docs/`)

| Carpeta | Contenido |
| --- | --- |
| `docs/classes/` | Cambios de clases, reservas, confirmaciones y recordatorios. |
| `docs/routines/` | Migraciones de rutinas, ciclos, vigencias y enlaces públicos. |
| `docs/online-training/` | Entrenamiento online, portal privado, recordatorios y calendario. |
| `docs/exercises/` | Biblioteca de ejercicios y videos. |
| `docs/events/` | Eventos diarios y turnos. |
| `docs/imports/` | Importaciones iniciales de datos. |
| `docs/facial-access/` | Integración de control de acceso. |

## Configuración y despliegue

| Archivo o servicio | Qué controlar |
| --- | --- |
| `vercel.json` | Cron jobs. En Hobby, cada cron debe ejecutarse como máximo una vez al día. |
| Vercel → Environment Variables | Claves de Supabase, Resend, Mercado Pago, Google y `CRON_SECRET`. |
| GitHub → `main` | Código que se despliega automáticamente a producción. |
| Supabase | Base de datos y políticas de acceso. |

## Reglas de seguridad

1. Nunca subir `.env.local`, claves JSON, tokens ni secretos a GitHub.
2. Antes de modificar una migración SQL ya aplicada, crear una migración nueva en `docs/`.
3. Antes de cambiar un cron, validar el plan de Vercel y el horario esperado en Uruguay.
4. Ejecutar TypeScript o build antes de subir cambios importantes.
5. Hacer `commit` y `push` de los cambios funcionales para conservar el respaldo en GitHub.
