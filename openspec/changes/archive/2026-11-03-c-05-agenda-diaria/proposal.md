# Proposal

## Why

Hoy los internos pueden autenticarse (C-03) y los pacientes pueden reservar (C-04), pero la secretaria no tiene forma de ver qué turnos hay en el día: la única lectura de turnos existente es interna y no está expuesta por API. Sin la agenda diaria (US-003) el consultorio no puede organizar la atención y los turnos reservados quedan invisibles para el personal.

## What Changes

- Nuevo endpoint privado `GET /api/agenda?fecha[&odontologoId]` que devuelve los turnos del día ordenados por hora, con paciente y odontólogo expandidos y el estado de cada turno (incluye cancelados).
- Autorización con los middlewares existentes: `require_auth()` + `require_role('secretaria', 'odontologo')`; cualquier otro actor recibe 401/403.
- Vínculo usuario ↔ odontólogo: migración `003_users_odontologo.sql` agrega `users.odontologo_id` (nullable, FK a `odontologos`). Un usuario con rol `odontologo` solo puede ver su propia agenda; sin vínculo configurado recibe 403 con código explícito.
- Scoping obligatorio por el `tenant_id` del JWT: nunca se listan turnos, pacientes ni teléfonos de otro tenant.
- Extensión del seed con dos usuarios internos sintéticos (secretaria y odontólogo vinculado) para que la agenda sea demostrable de punta a punta.

## Capabilities

### New Capabilities
- `agenda-turnos`: consulta privada de la agenda diaria de un consultorio — listado de turnos del día con paciente/odontólogo expandidos, filtro por odontólogo, alcance por rol y aislamiento por tenant.

### Modified Capabilities

<!-- Ninguna: el vínculo users.odontologo_id es un cambio de modelo de datos que no altera requisitos de user-auth; core-multitenant no incluye a users entre sus entidades base. -->

## Impact

- **Base de datos**: migración `003_users_odontologo.sql` (columna nullable + FK + índice) y extensión de `scripts/seed.js`.
- **Backend**: nuevo `app/http/agenda-routes.js` y `app/application/agenda-service.js`; consulta nueva `TurnoRepository.findByDay` con JOIN a pacientes y odontólogos; `UserRepository` pasa a exponer `odontologo_id`; wiring en `src/index.js`.
- **Contratos HTTP**: nuevo `GET /api/agenda` autenticado. No se modifican `/api/auth/*`, `/api/disponibilidad` ni `/api/turnos`.
- **Seguridad**: la agenda es la primera lectura privada de datos de pacientes; el teléfono solo se expone a roles internos del mismo tenant.
- **Dependencias**: C-02 (modelo) y C-03 (auth/RBAC) ya están archivados; C-04 aporta turnos reales para probar.
