# Design

## Context

Ver `proposal.md — Why`. Estado actual relevante:

- `TurnoRepository` ya expone `cancel(tenant_id, id)` y `cancelByToken(token_cancelacion)`, pero el segundo no está scopeado por tenant y ninguno lee el turno antes de actualizar.
- `reserva-service.js` define `ReservaError` (status + code) y el patrón de mapeo de errores hacia HTTP; `reserva-routes.js` resuelve el tenant público con `tenantMiddleware` + `resolverTenantId`.
- `domain/horario.js` centraliza `formatIsoBuenosAires`, el offset `-03:00` y las comparaciones de instantes.
- `requireAuth()` / `requireRole()` ya están probados en C-03; `req.user` trae `id`, `tenant_id` y `rol`.
- `.env.example` ya documenta `CANCEL_MIN_HOURS=24`; no hay migraciones pendientes: `estado` y `token_cancelacion` existen desde C-02.

## Goals / Non-Goals

**Goals:**

- Un único servicio de cancelación con las reglas de rol, antelación, idempotencia y tenant.
- Reutilizar los mecanismos de tenant y error existentes, sin duplicar lógica.
- Respuestas que nunca expongan `token_cancelacion`, `password_hash` ni teléfonos en el link público.

**Non-Goals:**

- Reprogramación o cambio de horario (fuera de v1).
- Registro de auditoría de quién canceló (`cancelado_por`) — no está en el modelo ni en la KB.
- UI: el formulario del link público es C-07 y la acción desde la agenda es C-08.
- Notificaciones al paciente (fuera de alcance v1).

## Decisions

### 1. Capability y módulos separados de la reserva

`app/application/cancelacion-service.js` + `app/http/cancelacion-routes.js`, montados en `/api`. Se mantiene `reserva-service` sin cambios de responsabilidad (crear/listar disponibilidad) y la cancelación queda aislada con su propio `CancelacionError`.

**Por qué**: la reserva pública ya es un módulo cerrado y probado (C-04); mezclar cancelación interna + pública agrandaría su superficie. **Alternativa descartada**: agregar los endpoints a `reserva-routes.js` (menos archivos, pero mezcla dos ciclos de vida y dos contratos de error).

### 2. Tenant por canal

- `DELETE /api/turnos/:id`: tenant exclusivamente de `req.user.tenant_id` (JWT); nunca de cabeceras.
- `GET|POST /api/turnos/cancelar/:token`: se aplica `tenantMiddleware()` y se resuelve el tenant con la misma lógica de `reserva-routes` (`x-tenant-id`, `x-tenant-slug`, subdominio o `TENANT_DEFAULT`), y el token se busca **dentro de ese tenant**.

**Por qué**: cumple RN-MT-01 y el caso de CHANGES "token de otro tenant → 404 sin filtrar existencia". **Alternativa descartada**: token global sin tenant (más simple, pero filtraría la existencia y contradice el roadmap).

### 3. Lectura previa del turno y cancelación idempotente

Ambos canales leen el turno antes de escribir:

1. `TurnoRepository.findById(tenant_id, id)` / `findByToken(tenant_id, token)`.
2. Si no existe → 404 `CANCELACION_TURNO_NO_ENCONTRADO`.
3. Si `estado === 'cancelado'` → 200 con el turno (idempotencia, antes de cualquier validación de fecha).
4. Si no aplica la antelación (solo canal público) → 422 `RN-TU-02`.
5. `cancel(tenant_id, id)` / `cancelByToken(tenant_id, token)` y respuesta 200.

**Por qué**: la lectura permite separar 404 de 403/422 y hace la idempotencia trivial. **Alternativa descartada**: `UPDATE ... WHERE estado != 'cancelado'` y deducir el caso desde `rowCount` (no distingue "no existe" de "ya cancelado").

### 4. Antelación mínima solo en el canal público

`CANCEL_MIN_HOURS` se lee en cada request: `Number.parseInt(process.env.CANCEL_MIN_HOURS ?? '24', 10)`; si no es un entero `>= 0`, se usa 24. Se bloquea cuando `inicio - ahora < minHoras * 3600_000` (comparación estricta: exactamente 24h se permite).

Los internos no tienen límite (decisión de producto): secretaria/odontólogo pueden cancelar incluso dentro de la ventana.

**Por qué**: una emergencia o reprogramación operativa no debe quedar bloqueada por la regla pensada para el paciente. **Alternativa descartada**: aplicar el límite a todos (más simple, pero impide a la secretaria resolver el día).

### 5. Alcance del odontólogo

El canal interno compara `turno.odontologo_id` con `user`:

- `secretaria`: cualquier turno del tenant.
- `odontologo`: se relee el usuario (`UserRepository.findById`) para obtener `odontologo_id` (mismo patrón que la agenda C-05). Sin vínculo → 403 `AGENDA_SIN_ODONTOLOGO`; turno de otro profesional → 403 `CANCELACION_ODONTOLOGO_AJENO`.

**Por qué**: coherencia con la agenda propia y menor privilegio. **Alternativa descartada**: usar solo el rol (cualquier odontólogo cancela todo).

### 6. Consultas nuevas en `TurnoRepository`

- `findByToken(tenant_id, token)`: `WHERE tenant_id = $1 AND token_cancelacion = $2`, JOIN a `pacientes` y `odontologos` con `tenant_id` en ambos JOIN, columnas explícitas (`id, inicio, fin, estado, paciente_id, paciente_nombre, odontologo_id, odontologo_nombre`). No selecciona `token_cancelacion` para la respuesta pública.
- `cancelByToken(tenant_id, token)`: agrega `tenant_id = $1` y mantiene `estado != 'cancelado'` como guarda de concurrencia.
- `findById` ya devuelve `token_cancelacion`; el servicio no lo copia a la respuesta.

**Por qué**: scoping en SQL además del filtro de aplicación (defensa en profundidad de RN-MT-01). **Alternativa descartada**: filtrar en memoria (trae datos de otro tenant a la respuesta).

### 7. Contrato HTTP y errores

| Caso | HTTP | Código |
|---|---|---|
| `id` no UUID | 400 | `CANCELACION_INVALID_INPUT` |
| Sin token / token inválido | 401 | `AUTH_*` |
| Rol no habilitado | 403 | `AUTH_FORBIDDEN` |
| Odontólogo sin vínculo | 403 | `AGENDA_SIN_ODONTOLOGO` |
| Odontólogo cancela turno ajeno | 403 | `CANCELACION_ODONTOLOGO_AJENO` |
| Turno/token no existe en el tenant | 404 | `CANCELACION_TURNO_NO_ENCONTRADO` |
| Cancelación pública sin antelación | 422 | `RN-TU-02` |

Respuestas:

- Interna (200): `{ id, inicio, fin, estado }`.
- Pública GET (200): `{ id, inicio, fin, estado, paciente: { nombre }, odontologo: { nombre } }`.
- Pública POST (200): `{ id, inicio, fin, estado }`.

Fechas serializadas con `formatIsoBuenosAires` (`-03:00`).

**Por qué**: el link público no necesita `id` del paciente ni teléfono; menos datos expuestos y el frontend de C-07 solo muestra fecha/hora/profesional/paciente.

### 8. Liberación del slot

No requiere lógica nueva: `findActivosByOdontologoAndDay` filtra `estado IN ('reservado','atendido')` y la exclusion constraint tiene `WHERE (estado != 'cancelado')`. Al pasar a `cancelado`, el slot vuelve a la grilla.

**Por qué**: reutiliza la garantía ya probada en C-04. **Riesgo**: caching futuro de disponibilidad; hoy no hay caché.

## Risks / Trade-offs

- **Doble cancelación concurrente** → `cancelByToken` conserva `estado != 'cancelado'`; si la segunda actualización devuelve null se responde 200 por idempotencia (el estado ya es el deseado).
- **`CANCEL_MIN_HOURS` mal configurado** → fallback silencioso a 24; se documenta en `.env.example` y en el servicio.
- **Enumeración por timing de tokens** → el token es aleatorio de 24 bytes; el 404 no distingue inexistente de otro tenant.
- **El link público revela el nombre del paciente** a quien posea el token → aceptado: el token es el secreto de acceso y se entrega al crear el turno; no se expone teléfono.
- **Zona horaria** → todas las comparaciones usan instantes `Date`; el corte se calcula en UTC y no depende de la sesión de Postgres.

## Migration Plan

1. No hay migraciones de base de datos.
2. Desplegar backend con el nuevo router montado en `/api`.
3. Configurar `CANCEL_MIN_HOURS` si se quiere otro valor (default 24; ya listado en `.env.example`).
4. Rollback: remover el montaje de `createCancelacionRouter`; las rutas dejan de existir y ningún dato cambia de forma.

## Open Questions

- Ninguna que afecte specs, enfoque o desglose de tareas.
