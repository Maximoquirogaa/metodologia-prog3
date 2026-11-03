# Spec Delta

## Purpose

Da a la secretaria y a los odontólogos una vista privada de los turnos del día del consultorio, con paciente y profesional expandidos, filtrable por odontólogo y estrictamente acotada al tenant del usuario autenticado.

## ADDED Requirements

### Requirement: Agenda diaria autenticada

El sistema SHALL exponer `GET /api/agenda` solo para usuarios internos autenticados con rol `secretaria` u `odontologo`, respondiendo 401 sin token válido y 403 con un rol no habilitado.

#### Scenario: Acceso sin token es rechazado

- **WHEN** se llama `GET /api/agenda` sin access token
- **THEN** el sistema responde 401 y no devuelve ningún turno

#### Scenario: Rol habilitado accede a la agenda

- **WHEN** un usuario con rol `secretaria` o `odontologo` llama `GET /api/agenda` con un token válido
- **THEN** el sistema responde 200 con la agenda del día solicitado

### Requirement: Listado de turnos del día

El sistema SHALL devolver los turnos del día indicado en `fecha` (calendario de Buenos Aires), ordenados por hora de inicio ascendente, incluyendo los estados `reservado`, `atendido` y `cancelado`.

#### Scenario: Turnos ordenados por hora

- **WHEN** la secretaria consulta un día con turnos a las 15:00, 09:00 y 12:00
- **THEN** el sistema los devuelve en ese orden: 09:00, 12:00, 15:00

#### Scenario: Los cancelados aparecen con su estado

- **WHEN** el día incluye un turno cancelado
- **THEN** el turno aparece en la lista con `estado` `cancelado`

#### Scenario: Día sin turnos devuelve lista vacía

- **WHEN** se consulta un día sin turnos
- **THEN** el sistema responde 200 con la lista de turnos vacía

### Requirement: Turno expandido con paciente y odontólogo

El sistema SHALL devolver cada turno con `id`, `inicio`, `fin`, `estado`, `paciente` (`id`, `nombre`, `telefono`) y `odontologo` (`id`, `nombre`), sin exponer `token_cancelacion` ni `password_hash`.

#### Scenario: Turno incluye datos del paciente y del odontólogo

- **WHEN** la secretaria consulta la agenda de un día con un turno reservado
- **THEN** cada item incluye el nombre y teléfono del paciente y el nombre del odontólogo

#### Scenario: La agenda no expone tokens de cancelación

- **WHEN** se consulta la agenda de un día con turnos
- **THEN** la respuesta no incluye `token_cancelacion` de ningún turno

### Requirement: Filtro opcional por odontólogo

El sistema SHALL aceptar `odontologoId` opcional para limitar la agenda a un odontólogo del tenant, respondiendo 404 si el odontólogo no pertenece al tenant del usuario.

#### Scenario: Filtrado por odontólogo

- **WHEN** la secretaria consulta la agenda con el `odontologoId` de un profesional del tenant
- **THEN** la respuesta incluye solo los turnos de ese odontólogo

#### Scenario: Odontólogo de otro tenant

- **WHEN** se consulta la agenda con el `odontologoId` de otro tenant
- **THEN** el sistema responde 404 y no expone datos de ese odontólogo

### Requirement: Agenda propia para el rol odontólogo

El sistema SHALL limitar a un usuario con rol `odontologo` a su propia agenda y rechazar con 403 cualquier intento de consultar la agenda de otro profesional.

#### Scenario: Odontólogo ve solo sus turnos

- **WHEN** un usuario `odontologo` consulta la agenda sin indicar `odontologoId`
- **THEN** el sistema devuelve únicamente los turnos del odontólogo vinculado a su usuario

#### Scenario: Odontólogo pide la agenda de otro profesional

- **WHEN** un usuario `odontologo` consulta la agenda con el `odontologoId` de otro profesional
- **THEN** el sistema responde 403 y no devuelve turnos

#### Scenario: Usuario odontólogo sin vínculo configurado

- **WHEN** un usuario con rol `odontologo` cuyo `odontologo_id` es nulo consulta la agenda
- **THEN** el sistema responde 403 con código `AGENDA_SIN_ODONTOLOGO`

### Requirement: Aislamiento por tenant en la agenda

El sistema SHALL tomar el tenant exclusivamente del access token y nunca devolver turnos, pacientes ni teléfonos de otro tenant, ignorando cabeceras de tenant de la petición.

#### Scenario: Cabecera de otro tenant no cambia el alcance

- **WHEN** un usuario del tenant A consulta la agenda enviando `x-tenant-id` del tenant B
- **THEN** el sistema devuelve solo turnos del tenant A

#### Scenario: Turnos de otro tenant no aparecen

- **WHEN** dos tenants tienen turnos el mismo día
- **THEN** la agenda de un usuario solo contiene los turnos de su propio tenant

### Requirement: Validación de fecha y parámetros de agenda

El sistema SHALL responder 400 cuando falta `fecha`, su formato no es `YYYY-MM-DD` o `odontologoId` no es un UUID válido.

#### Scenario: Fecha faltante o inválida

- **WHEN** se llama `GET /api/agenda` sin `fecha` o con un formato distinto de `YYYY-MM-DD`
- **THEN** el sistema responde 400

#### Scenario: OdontologoId mal formado

- **WHEN** se llama `GET /api/agenda?fecha=2026-11-09&odontologoId=no-es-uuid`
- **THEN** el sistema responde 400
