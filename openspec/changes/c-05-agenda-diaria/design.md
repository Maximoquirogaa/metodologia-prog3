# Design

## Context

Ver `proposal.md — Why`. Estado actual relevante:

- `requireAuth()` adjunta `req.user = { id, tenant_id, rol, email, jti, exp }` y `requireRole(...roles)` devuelve 403 (`AUTH_FORBIDDEN`). Ambos están probados en C-03.
- `users` (migración 002) **no** tiene vínculo con `odontologos`; la KB pide que el rol `odontologo` vea "su propia" agenda.
- `TurnoRepository.findByTenant()` filtra por `odontologo_id` y `estado` pero no por rango de fechas ni expande paciente/odontólogo.
- `app/domain/horario.js` (C-04) ya centraliza la zona de Buenos Aires como offset fijo `-03:00` y expone `parseFecha` / `formatIsoBuenosAires`.
- El seed crea tenant, un odontólogo y tres pacientes, pero **no** crea usuarios internos.

## Goals / Non-Goals

**Goals:**

- Resolver el alcance de la agenda (tenant + rol + odontólogo) en una sola capa testeable.
- Una única consulta SQL por request con JOIN a paciente y odontólogo.
- No exponer datos de pacientes fuera del tenant ni a actores anónimos.

**Non-Goals:**

- Alta/edición de turnos desde la agenda (C-06 cubre cancelación).
- Gestión de usuarios o asignación de odontólogos desde UI/API.
- Vista semanal o paginación: la agenda es de un día por request.

## Decisions

### 1. Vínculo `users.odontologo_id` con migración 003

`backend/migrations/003_users_odontologo.sql`:

- `ALTER TABLE users ADD COLUMN IF NOT EXISTS odontologo_id UUID NULL REFERENCES odontologos(id) ON DELETE SET NULL;`
- índice `(tenant_id, odontologo_id)`.

**Por qué**: es la única forma de cumplir "ver propia" sin inventar el vínculo por email ni ensuciar el JWT. Nullable para no romper los usuarios ya creados (secretarias no tienen odontólogo). **Alternativas descartadas**: claim en el JWT (invalida tokens y no refleja cambios), comparar por email (no hay email en `odontologos`).

### 2. Resolución del alcance en el servicio

`app/application/agenda-service.js` expone `buildAgenda({ user, fecha, odontologoId, ahora, userRepository, odontologoRepository, turnoRepository })`:

1. `fecha` → `parseFecha` (400 si inválida).
2. Si `user.rol === 'odontologo'`: se relee el usuario con `UserRepository.findById(tenant_id, user.id)` para obtener `odontologo_id`. Si es `null` → 403 `AGENDA_SIN_ODONTOLOGO`. Si llega `odontologoId` y no coincide con el propio → 403 `AGENDA_ODONTOLOGO_AJENO`. Alcance efectivo = propio.
3. Si `user.rol === 'secretaria'`: con `odontologoId`, se valida con `OdontologoRepository.findById(tenant_id, ...)`; si no existe → 404 `AGENDA_ODONTOLOGO_NO_ENCONTRADO`. Alcance efectivo = el pedido (o todos).
4. Consulta con `TurnoRepository.findByDay(tenant_id, { desde, hasta, odontologo_id })` y respuesta `{ fecha, odontologoId, turnos: [...] }`.

**Por qué**: centraliza RBAC de datos en un solo lugar y deja el router delgado. Se relee el usuario en cada request (una query por PK) en vez de confiar en el token, así un cambio del vínculo aplica sin re-login.

### 3. Rango del día reutilizando `horario.js`

Se agrega `rangoDelDia(fecha)` a `app/domain/horario.js` que devuelve `{ desde, hasta }` (00:00 a 24:00 de Buenos Aires) reutilizando el offset fijo ya existente.

**Por qué**: evita duplicar la lógica de zona horaria y garantiza que un turno de las 23:00 de un día no se mezcle con el siguiente. **Alternativa descartada**: `fecha::date` en SQL (depende del timezone de la sesión de Postgres y rompe con el offset del dominio).

### 4. `TurnoRepository.findByDay` con JOIN y columnas explícitas

```sql
SELECT t.id, t.inicio, t.fin, t.estado,
       p.id AS paciente_id, p.nombre AS paciente_nombre, p.telefono AS paciente_telefono,
       o.id AS odontologo_id, o.nombre AS odontologo_nombre
FROM turnos t
JOIN pacientes p ON p.id = t.paciente_id AND p.tenant_id = t.tenant_id
JOIN odontologos o ON o.id = t.odontologo_id AND o.tenant_id = t.tenant_id
WHERE t.tenant_id = $1 AND t.inicio >= $2 AND t.inicio < $3
  [AND t.odontologo_id = $4]
ORDER BY t.inicio ASC;
```

`token_cancelacion` no se selecciona: la agenda no lo necesita y es un secreto de cancelación.

**Por qué**: JOIN con `tenant_id` en ambas condiciones refuerza RN-MT-01 a nivel SQL; orden resuelto por la base. **Alternativa**: dos consultas + join en memoria (más round-trips, sin ganancia).

### 5. Exponer `odontologo_id` en `UserRepository`

`findById` y `findByEmailAndTenant` agregan `odontologo_id` a las columnas. `UserSchema` acepta `odontologo_id` UUID nullable opcional.

**Por qué**: el servicio necesita el vínculo y el login ya devuelve solo datos públicos (`publicUser`), así que no se filtra nada nuevo por API.

### 6. Seed con usuarios internos demo

`scripts/seed.js` crea (idempotente por `(tenant_id, email)`) dos usuarios sintéticos con `bcrypt`:

- `secretaria@demo.local` / rol `secretaria`, sin `odontologo_id`.
- `odontologo@demo.local` / rol `odontologo`, vinculado al odontólogo demo.

**Por qué**: sin usuarios internos la agenda no es demostrable; el seed es la vía documentada para datos demo. Contraseña demo documentada en el propio seed, nunca datos reales (regla dura).

### 7. Contrato HTTP y errores

- 401 sin token / token inválido (lo resuelve `requireAuth`).
- 403 `AUTH_FORBIDDEN`, `AGENDA_SIN_ODONTOLOGO`, `AGENDA_ODONTOLOGO_AJENO`.
- 404 `AGENDA_ODONTOLOGO_NO_ENCONTRADO`.
- 400 `AGENDA_INVALID_INPUT` (fecha faltante/mal formada, UUID inválido).
- Respuesta: `{ fecha, odontologoId, turnos: [{ id, inicio, fin, estado, paciente: { id, nombre, telefono }, odontologo: { id, nombre } }] }`, fechas en ISO `-03:00`.

## Risks / Trade-offs

- **Teléfonos de pacientes expuestos** → solo a roles internos autenticados y siempre filtrados por el tenant del JWT; testeado explícitamente.
- **Usuario odontólogo sin vínculo** → no ve nada (403) en lugar de ver toda la agenda: más seguro, pero requiere configurar el vínculo; el seed lo deja listo.
- **Migración sobre `users`** → columna nullable y `IF NOT EXISTS`, sin downtime ni backfill obligatorio.
- **Releer el usuario por request** → una query extra por llamada a la agenda; aceptable para el volumen del consultorio y evita tokens obsoletos.
- **Seed con contraseñas demo** → riesgo de reutilización en producción; se documenta como solo demo y no reemplaza un alta real de usuarios.

## Migration Plan

1. Aplicar `003_users_odontologo.sql` (`npm run migrate`); es aditiva.
2. Desplegar backend con el router de agenda.
3. Correr `npm run seed` para crear los usuarios demo y vincular el odontólogo.
4. Rollback: remover el montaje de `/api/agenda`; la columna puede quedarse sin efecto o dropearse con `DROP INDEX` + `ALTER TABLE users DROP COLUMN odontologo_id`.

## Open Questions

- Ninguna que afecte specs, enfoque o desglose de tareas.
