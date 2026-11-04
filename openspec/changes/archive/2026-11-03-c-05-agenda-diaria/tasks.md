# Tasks

## 1. Modelo, repositorio y seed

- [x] 1.1 Crear `backend/migrations/003_users_odontologo.sql` con `odontologo_id` nullable, FK a `odontologos(id)` `ON DELETE SET NULL` e índice `(tenant_id, odontologo_id)` — verificación: test de migraciones que verifica columna/FK/índice y `npm run migrate` sin errores.
- [x] 1.2 Agregar `odontologo_id` a `UserRepository.findById` y `findByEmailAndTenant` y al `UserSchema` — verificación: tests que confirman que la columna se selecciona sin `SELECT *`, se devuelve en `findById` y el schema acepta UUID o null.
- [x] 1.3 Extender `scripts/seed.js` para crear idempotentemente `secretaria@demo.local` (rol `secretaria`) y `odontologo@demo.local` (rol `odontologo`, vinculado al odontólogo demo) con hash bcrypt — verificación: test que corre el seed dos veces y confirma que no duplica usuarios y que el vínculo queda seteado.

## 2. Dominio y consulta de agenda

- [x] 2.1 Agregar `rangoDelDia(fecha)` a `backend/app/domain/horario.js` (00:00 a 24:00 de Buenos Aires) — verificación: test que un turno a las 23:59 cae dentro del rango y uno a las 00:00 del día siguiente queda fuera.
- [x] 2.2 Agregar `TurnoRepository.findByDay(tenant_id, { desde, hasta, odontologo_id })` con JOIN a `pacientes` y `odontologos` por tenant, columnas explícitas, todos los estados y `ORDER BY inicio ASC` — verificación: test con db mockeada que verifica SQL (sin `SELECT *`, sin `token_cancelacion`), doble condición `tenant_id` en los JOIN, orden y filtro opcional por odontólogo.

## 3. Servicio de agenda

- [x] 3.1 Implementar `buildAgenda` para el rol `secretaria`: agenda completa del tenant, filtro opcional por odontólogo y 404 si el odontólogo no pertenece al tenant — verificación: tests de lista ordenada, lista vacía, filtro aplicado y 404.
- [x] 3.2 Implementar el alcance del rol `odontologo`: solo su propia agenda, 403 al pedir la de otro profesional y 403 `AGENDA_SIN_ODONTOLOGO` si el vínculo es nulo — verificación: un test por caso.
- [x] 3.3 Mapear la respuesta expandida (`paciente` con nombre/teléfono, `odontologo` con nombre, fechas ISO `-03:00`, sin `token_cancelacion`) e incluir cancelados con su estado — verificación: test que recorre la respuesta y falla si aparece `token_cancelacion` o `password_hash`, y test de un turno cancelado presente.
- [x] 3.4 Validar `fecha` y `odontologoId` en el servicio con 400 `AGENDA_INVALID_INPUT` — verificación: tests de fecha faltante, fecha mal formada y UUID inválido.

## 4. Rutas privadas y wiring

- [x] 4.1 Crear `backend/app/http/agenda-routes.js` con `requireAuth()` + `requireRole('secretaria', 'odontologo')` y montar `GET /api/agenda` en `createApp` — verificación: tests HTTP con 200, 401 sin token, 401 con token inválido, 403 con rol denegado y 400 por parámetros inválidos.
- [x] 4.2 Verificar aislamiento por tenant del token: la cabecera `x-tenant-id` de otro tenant no cambia el resultado — verificación: test HTTP con un token del tenant A y cabecera del tenant B que devuelve solo turnos de A.
- [x] 4.3 Verificar que la agenda no expone secretos (`token_cancelacion`, `password_hash`) ni datos de otro tenant — verificación: test que serializa la respuesta completa y falla si aparece cualquiera de esos campos o un paciente ajeno.

## 5. Verificación de integración

- [x] 5.1 Correr la suite completa del backend (`npm test`) — verificación: todos los tests pasan sin regresiones de C-02/C-03/C-04.
- [x] 5.2 Correr `npm run lint` — verificación: lint limpio sobre los archivos nuevos.
- [x] 5.3 Contrastar cada escenario de `specs/agenda-turnos/spec.md` con al menos un test y `openspec validate c-05-agenda-diaria --strict` — verificación: matrix de escenarios cubiertos sin huecos y validación estricta en verde.

## Workflow follow-up

- Ejecutar `/opsx:apply c-05-agenda-diaria` para implementar las tareas.
- Actualizar `CHANGES.md` marcando C-05 como archivado tras `/opsx:archive c-05-agenda-diaria`.
