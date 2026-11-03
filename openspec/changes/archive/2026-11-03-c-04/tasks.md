# Tasks

## 1. Dominio de horarios y slots

- [x] 1.1 Crear `backend/app/domain/horario.js` con `HORARIO_ATENCION` (Lun–Vie, 09:00–18:00, slots de 30 min, offset `-03:00`) y `generarSlots(fecha)` — verificación: test unitario que un día hábil devuelve 18 slots de 09:00 a 17:30 y un sábado devuelve lista vacía.
- [x] 1.2 Implementar `estaDentroDeHorario(inicio, fin)` y `slotEnPasado(inicio, ahora)` en el mismo módulo — verificación: tests de borde (08:59 falso, 17:30–18:00 verdadero, 17:45–18:15 falso, sábado falso, slot ya comenzado verdadero).

## 2. Consultas de repositorio para la reserva

- [x] 2.1 Agregar `TurnoRepository.findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta)` con `estado IN ('reservado','atendido')`, columnas explícitas y filtro por tenant — verificación: test con db mockeada que verifica SQL (sin `SELECT *`), parámetros y que los cancelados no se incluyen.
- [x] 2.2 Agregar `PacienteRepository.findByTelefono(tenant_id, telefono)` con scope por tenant — verificación: tests que devuelven el paciente del tenant y `null` cuando el teléfono existe solo en otro tenant.

## 3. Servicio de disponibilidad y creación de turnos

- [x] 3.1 Implementar `buildDisponibilidad({ tenant_id, odontologo_id, fecha, ahora })` en `backend/app/application/reserva-service.js`: grilla de horario menos turnos activos y menos slots ya comenzados — verificación: tests de slot ocupado excluido, slot de turno cancelado incluido y respuesta vacía en fin de semana.
- [x] 3.2 Implementar `crearTurno` con validaciones: odontólogo del tenant (404), `fin > inicio` e `inicio` futuro (400), dentro de horario (422 `RN-TU-04`), nombre+teléfono (422 `RN-TU-03`) y solapamiento previo (422 `RN-TU-01`) — verificación: un test por caso con el `code` esperado.
- [x] 3.3 Implementar find-or-create de paciente por teléfono y generación de `token_cancelacion` con `crypto.randomBytes(24).toString('base64url')` — verificación: tests de reutilización sin sobrescribir nombre, alta de paciente nuevo y token de al menos 32 caracteres único entre dos turnos.
- [x] 3.4 Mapear el error PostgreSQL `23P01` de `turnos_no_overlap` a 422 `RN-TU-01` y propagar cualquier otro error — verificación: test con db mockeada que lanza `{ code: '23P01', constraint: 'turnos_no_overlap' }` y otro con un error distinto que no se convierte en 422.

## 4. Rutas públicas y wiring

- [x] 4.1 Crear `backend/app/http/reserva-routes.js` con `GET /api/disponibilidad` (valida `odontologoId` UUID y `fecha` `YYYY-MM-DD` → 400) y `POST /api/turnos` (201 con `id`, `estado`, `inicio`, `fin`, `token_cancelacion`) — verificación: tests HTTP con repositorios mockeados que cubren 200, 201, 400, 404 y 422.
- [x] 4.2 Montar el router en `createApp` aplicando `tenantMiddleware` solo a las rutas de reserva y ampliar las dependencias inyectables — verificación: `/api/disponibilidad` y `/api/turnos` responden sin token (no 401) y `/api/health` y `/api/auth/*` siguen funcionando como antes.
- [x] 4.3 Verificar que la disponibilidad no expone `token_cancelacion` ni datos de pacientes — verificación: test que recorre la respuesta de `GET /api/disponibilidad` y falla si aparece `token_cancelacion`, `telefono` o `nombre` de paciente.

## 5. Verificación de integración

- [x] 5.1 Correr la suite completa del backend (`npm test`) — verificación: todos los tests pasan, incluidos los de C-02/C-03 sin regresiones.
- [x] 5.2 Correr `npm run lint` — verificación: lint limpio sobre los archivos nuevos.
- [x] 5.3 Contrastar cada escenario de `specs/turnos-reserva/spec.md` con al menos un test y `openspec validate c-04 --strict` — verificación: matrix de escenarios cubiertos sin huecos y validación estricta en verde.

## Workflow follow-up

- Ejecutar `/opsx:apply c-04` para implementar las tareas.
- Actualizar `CHANGES.md` marcando C-04 como archivado tras `/opsx:archive c-04`.
