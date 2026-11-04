# Proposal

## Why

Hoy un turno reservado (C-04) no puede liberarse: no existe ningún endpoint de cancelación. El paciente que no puede asistir deja el slot bloqueado y la secretaria no tiene forma de liberarlo, lo que contradice US-004 y la regla RN-TU-02. Sin cancelación, la agenda (C-05) solo crece y los turnos perdidos no se recuperan.

## What Changes

- Nuevo `DELETE /api/turnos/:id` autenticado (secretaria/odontólogo) para cancelar un turno del tenant. La secretaria puede cancelar cualquier turno del consultorio; un odontólogo solo los propios (403 en caso contrario).
- Los internos pueden cancelar en cualquier momento: la antelación mínima no les aplica (decisión de producto).
- Nuevo flujo público por link, sin login: `GET /api/turnos/cancelar/:token` devuelve los datos del turno (fecha, hora, odontólogo y nombre del paciente) para confirmar, y `POST /api/turnos/cancelar/:token` ejecuta la cancelación.
- La cancelación pública exige al menos `CANCEL_MIN_HOURS` de antelación (default 24, leído del entorno en cada request); si no se cumple responde `422` con código `RN-TU-02`.
- Cancelar es idempotente: repetir la operación sobre un turno ya cancelado responde `200` con `estado: "cancelado"`.
- Token inválido o inexistente → `404`; nunca se filtra la existencia de turnos de otro tenant. La cancelación libera el slot automáticamente porque la disponibilidad excluye `cancelado`.
- No se agregan columnas ni migraciones: el modelo de C-02 ya tiene `estado`, `token_cancelacion` y la exclusion constraint condicionada a `estado != 'cancelado'`.

## Capabilities

### New Capabilities

- `cancelacion-turnos`: cancelación de turnos por internos autenticados y por link público con token, regla de antelación mínima configurable, idempotencia y liberación del slot.

### Modified Capabilities

<!-- Ninguna: turnos-reserva ya define la creación y el token; el comportamiento de cancelación es una capability nueva. -->

## Impact

- **Backend**: nuevo `app/application/cancelacion-service.js` y `app/http/cancelacion-routes.js`; `TurnoRepository` reutiliza/ajusta `cancel`, `cancelByToken` y agrega la lectura por token con paciente/odontólogo expandidos; wiring en `src/index.js`.
- **Contratos HTTP**: `DELETE /api/turnos/:id`, `GET /api/turnos/cancelar/:token`, `POST /api/turnos/cancelar/:token`. No se modifican `/api/disponibilidad`, `/api/turnos` (creación) ni `/api/agenda`.
- **Configuración**: variable `CANCEL_MIN_HOURS` (default 24) documentada en `.env.example`.
- **Seguridad**: el token de cancelación es el único secreto del flujo público; el endpoint de información no expone teléfono, `token_cancelacion` ni `password_hash`.
- **Dependencias**: C-04 (turnos y token) ya archivado; C-05 aporta la agenda desde la que se cancelará en C-08.
