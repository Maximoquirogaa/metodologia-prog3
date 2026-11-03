# Proposal

## Why

El sistema ya tiene el modelo multi-tenant, la constraint anti-overlap y la autenticación de internos, pero todavía nadie puede reservar: no existe forma de consultar horarios libres ni de crear un turno. Sin esto no hay producto demostrable (US-001 y US-002) y las métricas de aceptación (0 turnos superpuestos) no pueden verificarse de punta a punta.

## What Changes

- Nuevo endpoint público `GET /api/disponibilidad?odontologoId&fecha` que genera los slots de 30 minutos dentro del horario de atención (Lun–Vie 09:00–18:00, zona `America/Argentina/Buenos_Aires`) y excluye los ocupados.
- Nuevo endpoint público `POST /api/turnos` que crea (o reutiliza) el paciente por teléfono dentro del tenant y registra el turno en estado `reservado`, devolviendo su `token_cancelacion`.
- Errores de negocio con la convención del proyecto: HTTP 422 + `code` (`RN-TU-01` solapamiento, `RN-TU-03` paciente incompleto, `RN-TU-04` fuera de horario).
- Defensa en dos capas contra el solapamiento: validación en aplicación (consulta previa) y la exclusion constraint de base ya existente como garantía final.
- Sin autenticación en ambos endpoints (DD-02: la reserva pública v1 no exige login).

## Capabilities

### New Capabilities
- `turnos-reserva`: comportamiento de reserva pública de turnos — cálculo de disponibilidad por odontólogo y fecha, creación de turno con paciente mínimo (nombre + teléfono) y rechazo de solapamientos y horarios inválidos.

### Modified Capabilities

<!-- Ninguna: core-multitenant ya define la constraint anti-overlap y el registro de pacientes; C-04 no cambia esos requisitos, solo los consume desde la API. -->

## Impact

- **Backend** (`backend/`): nuevas rutas `app/http/reserva-routes.js` (o equivalente), servicio de disponibilidad/creación en `app/application/`, constantes de horario y zona en `app/domain/`, consultas de ocupación en `app/infrastructure/repositories/index.js`, wiring en `src/index.js`.
- **Base de datos**: sin migraciones nuevas; se reutilizan `turnos`, `pacientes`, `odontologos` y `turnos_no_overlap`.
- **Contratos HTTP**: dos endpoints públicos nuevos; no se modifican los existentes (`/api/health`, `/api/auth/*`).
- **Configuración**: se apoya en `TENANT_DEFAULT` y en la resolución de tenant por header (`x-tenant-id` / `x-tenant-slug`) ya implementada en `app/infrastructure/tenant.js`.
- **Riesgo**: la reserva concurrente del mismo slot depende de la constraint de base; el mapeo del error `23P01` a `422 RN-TU-01` debe ser explícito.
