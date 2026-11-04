# Tasks

## 1. Consultas de repositorio

- [x] 1.1 Agregar `TurnoRepository.findByToken(tenant_id, token)` con JOIN a `pacientes` y `odontologos` por tenant, columnas explícitas y sin `token_cancelacion` — verificación: test con db mockeada que valida el `WHERE tenant_id = $1 AND token_cancelacion = $2`, la doble condición de tenant en los JOIN y la ausencia de `SELECT *`/`token_cancelacion`.
- [x] 1.2 Cambiar `TurnoRepository.cancelByToken(tenant_id, token)` para scopear por tenant manteniendo `estado != 'cancelado'`, y conservar `cancel(tenant_id, id)` — verificación: tests de SQL que verifican `tenant_id` como `$1` y que un token de otro tenant no actualiza filas.

## 2. Servicio de cancelación

- [x] 2.1 Implementar la cancelación interna en `app/application/cancelacion-service.js`: 404 si no existe en el tenant, 200 idempotente si ya está cancelado, secretaria puede cancelar cualquiera y odontólogo solo los propios (403) — verificación: un test por caso.
- [x] 2.2 Implementar el alcance del odontólogo releyendo el usuario (`UserRepository.findById`) y devolviendo 403 `AGENDA_SIN_ODONTOLOGO` cuando no tiene vínculo — verificación: tests de vínculo nulo y de turno ajeno.
- [x] 2.3 Implementar la cancelación pública por token: 404 si el token no existe en el tenant, 200 idempotente, y 422 `RN-TU-02` cuando `inicio - ahora < CANCEL_MIN_HOURS` — verificación: tests de token inválido, token de otro tenant, ya cancelado y ventana bloqueada.
- [x] 2.4 Leer `CANCEL_MIN_HOURS` del entorno en cada request con default 24 y fallback ante valores inválidos — verificación: tests que cambian `process.env.CANCEL_MIN_HOURS` entre llamadas y confirman que el corte cambia sin reiniciar.
- [x] 2.5 Mapear las respuestas: interna `{ id, inicio, fin, estado }`, pública GET con `paciente.nombre` y `odontologo.nombre`, fechas ISO `-03:00`, sin `token_cancelacion`, teléfono ni `password_hash` — verificación: test que serializa la respuesta y falla si aparece un campo prohibido.
- [x] 2.6 Validar el `id` interno con 400 `CANCELACION_INVALID_INPUT` cuando no es UUID — verificación: test de id mal formado.

## 3. Rutas y wiring

- [x] 3.1 Crear `app/http/cancelacion-routes.js` con `DELETE /turnos/:id` (`requireAuth()` + `requireRole('secretaria','odontologo')`) y `GET|POST /turnos/cancelar/:token` (`tenantMiddleware()`) y montarlo en `createApp` — verificación: tests HTTP de 200, 401 sin token, 403 por rol, 404 y 400.
- [x] 3.2 Verificar el aislamiento por tenant en ambos canales: la cabecera de otro tenant no cambia el alcance interno y un token de otro tenant responde 404 — verificación: tests HTTP con dos tenants.
- [x] 3.3 Verificar el flujo público completo: GET muestra el turno sin teléfono ni token, POST con antelación suficiente cancela y el slot reaparece en `GET /api/disponibilidad` — verificación: test HTTP de integración secuencial sobre repos mockeados.

## 4. Verificación de integración

- [x] 4.1 Correr la suite completa del backend (`npm test`) — verificación: todos los tests pasan sin regresiones de C-02/C-03/C-04/C-05.
- [x] 4.2 Correr `npm run lint` — verificación: lint limpio sobre los archivos nuevos y modificados.
- [x] 4.3 Contrastar cada escenario de `specs/cancelacion-turnos/spec.md` con al menos un test y `openspec validate c-06-cancelacion-turnos --strict` — verificación: matriz de escenarios cubiertos sin huecos y validación estricta en verde.

## Workflow follow-up

- Ejecutar `/opsx:apply c-06-cancelacion-turnos` para implementar las tareas.
- Actualizar `CHANGES.md` marcando C-06 como archivado tras `/opsx:archive c-06-cancelacion-turnos`.
