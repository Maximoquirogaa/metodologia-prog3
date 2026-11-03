# Design

## Context

Ver `proposal.md — Why`. Estado actual relevante:

- `backend/src/index.js` expone `createApp({ userRepository, tenantRepository })` y monta solo `/api/health` y `/api/auth`; los repositorios se inyectan para poder testear con dobles.
- `backend/migrations/001_core_models.sql` ya define `turnos` con `CHECK (inicio < fin)`, `CHECK` de estado y la constraint `turnos_no_overlap` (`EXCLUDE USING gist (odontologo_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado != 'cancelado')`). No hace falta migración nueva.
- `app/infrastructure/repositories/index.js` ya tiene `TurnoRepository`, `PacienteRepository`, `OdontologoRepository` y `TenantRepository` con scope por `tenant_id` y columnas explícitas.
- `app/infrastructure/tenant.js` resuelve tenant por `x-tenant-id`, `x-tenant-slug`, subdominio o `TENANT_DEFAULT`.
- `app/domain/models.js` ya valida `TurnoSchema` y `PacienteSchema` con zod (incluye `inicio < fin` y teléfono mínimo).
- Los tests usan `node --test` con repositorios mockeados y HTTP real vía `app.listen(0)`.

## Goals / Non-Goals

**Goals:**

- Generar la grilla de disponibilidad de forma determinística y testeable, sin dependencias nuevas.
- Garantizar 0 solapamientos incluso bajo concurrencia, apoyándose en la constraint existente.
- Mantener las rutas públicas sin auth y el tenant resuelto por el middleware existente.

**Non-Goals:**

- Horarios por odontólogo o excepciones (feriados, almuerzos): se mantiene una constante compartida.
- Login de paciente, recordatorios, pagos o reprogramación.
- Cancelación (C-06) y agenda autenticada (C-05): este change solo consume `token_cancelacion` en la creación.

## Decisions

### 1. Grilla de 30 minutos en una constante de dominio

`app/domain/horario.js` exporta `HORARIO_ATENCION` (`dias: [1..5]`, `apertura: '09:00'`, `cierre: '18:00'`, `duracionSlotMin: 30`) y helpers puros `generarSlots(fecha)` y `estaDentroDeHorario(inicio, fin)`.

- **Por qué**: la KB define el horario pero no la granularidad; 30' es el default acordado. Una constante compartida evita una tabla de horarios que la KB no contempla y que C-04 no financia.
- **Alternativas**: tabla `odontologo_horarios` (más flexible, requiere migración y CRUD fuera de scope); env var por odontólogo (sin sustento en la KB).

### 2. Zona horaria como offset fijo `-03:00`

La grilla se construye con `Date.UTC(fecha, hh - 3, mm)` y se serializa con offset `-03:00`. No se usa `Intl` ni librerías de TZ.

- **Por qué**: Argentina no aplica horario de verano desde 2009; el offset fijo evita dependencias y hace los tests determinísticos.
- **Alternativas**: `date-fns-tz`/`Temporal` (dependencia o soporte aún experimental en Node 20/24); leer `TZ` de la base por tenant (sobredimensionado para v1).

### 3. Disponibilidad = grilla − ocupados

`app/application/reserva-service.js` (funciones puras + servicio con repositorios inyectados):

1. `TurnoRepository.findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta)` — nueva consulta con `estado IN ('reservado','atendido')` y rango del día; columnas explícitas.
2. `generarSlots(fecha)` produce la grilla.
3. Se descartan los slots que solapan con algún turno activo y los que ya comenzaron (`inicio <= now`) para no ofrecer horarios pasados de hoy.

Respuesta: `{ fecha, odontologoId, slots: [{ inicio, fin }] }` con ISO `-03:00`. Día sin atención → `slots: []` con 200 (así lo exige el spec).

- **Por qué**: una sola query por request, cálculo en memoria (máx. 18 slots).
- **Alternativa**: generar slots en SQL con `generate_series`; menos testeable y mezcla dominio con persistencia.

### 4. Doble capa anti-overlap con mapeo explícito de `23P01`

Antes de insertar se consultan los turnos activos que solapan (chequeo de aplicación → 422 `RN-TU-01`). Al insertar, `catch` del error PostgreSQL `23P01` (`exclusion_violation`) se traduce al mismo 422. La constraint es la fuente de verdad.

- **Por qué**: el chequeo previo da un mensaje de negocio claro; la constraint cubre la carrera entre dos requests.
- **Riesgo aceptado**: `23P01` también puede originar de otras constraints; el código del driver y el nombre `turnos_no_overlap` se verifican antes de mapear.

### 5. Paciente find-or-create por `(tenant_id, telefono)` sin unique index

Se agrega `PacienteRepository.findByTelefono(tenant_id, telefono)` y el servicio reutiliza el registro existente sin sobrescribir el nombre. No se crea índice único ni migración nueva: la búsqueda usa `idx_pacientes_tenant`.

- **Por qué**: una familia puede compartir teléfono; un unique rompería casos legítimos y la KB no lo pide. A escala demo el filtro por `tenant_id` alcanza.
- **Riesgo**: dos reservas simultáneas con el mismo teléfono nuevo pueden crear dos pacientes. Impacto bajo (no afecta la constraint de turnos) y se documenta; se puede endurecer en C-06 o con deduplicación posterior.

### 6. Módulos y wiring

- `app/http/reserva-routes.js`: router Express delgado con `{ tenantRepository, odontologoRepository, pacienteRepository, turnoRepository, now }` inyectables; monta `GET /api/disponibilidad` y `POST /api/turnos`.
- `app/application/reserva-service.js`: reglas, validación de slot, find-or-create, generación de token.
- `src/index.js`: `createApp` acepta los repositorios nuevos y monta el router; el `tenantMiddleware` se aplica solo a este router.
- Token: `crypto.randomBytes(24).toString('base64url')` (32 chars), generado en el servicio.

- **Por qué**: mantiene el patrón de inyección que ya usan los tests de auth y health, sin tocar `user-auth`.

### 7. Contrato de errores

- 400: input inválido (fecha no `YYYY-MM-DD`, UUID malformado, `fin <= inicio`, `inicio` en el pasado).
- 404: tenant inexistente u odontólogo que no pertenece al tenant (no se filtra existencia cross-tenant).
- 422: `{ error, code }` con `RN-TU-01`, `RN-TU-03`, `RN-TU-04`, según la convención del proyecto.

## Risks / Trade-offs

- **Offset fijo `-03:00`** → si el sistema se despliega en otro país/zona, la grilla queda mal. Mitigación: constante única en `app/domain/horario.js` para cambiar en un solo lugar.
- **Duplicado de pacientes por concurrencia** → impacto bajo; se documenta y se resuelve con deduplicación si aparece en C-06.
- **Rechazo de turnos en el pasado (`400`)** → comportamiento no cubierto explícitamente por el spec; se adopta para evitar reservas absurdas y se registra como supuesto a validar.
- **Mapping de `23P01`** → verificar nombre de constraint antes de mapear para no convertir otros errores de exclusión en `RN-TU-01`.
- **Slots de hoy ya comenzados** → se filtran; el spec solo ejemplifica días futuros, por lo que no hay conflicto.

## Migration Plan

Sin migraciones de base. Deploy del backend con el router nuevo; rollback = remover el montaje de `/api/disponibilidad` y `/api/turnos` (no hay datos nuevos más allá de turnos/pacientes que el modelo ya soporta).

## Open Questions

- Ninguna que afecte specs, enfoque o desglose de tareas.
