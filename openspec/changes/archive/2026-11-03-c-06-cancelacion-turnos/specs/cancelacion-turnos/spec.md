# Spec Delta

## Purpose

Permite liberar turnos cancelándolos desde la operación interna o desde un link público con token, respetando la antelación mínima del consultorio, sin filtrar datos entre tenants y liberando el slot para una nueva reserva.

## ADDED Requirements

### Requirement: Cancelación interna autenticada

El sistema SHALL exponer `DELETE /api/turnos/:id` solo para usuarios internos autenticados con rol `secretaria` u `odontologo`, respondiendo 401 sin token válido y 403 con un rol no habilitado.

#### Scenario: Sin token no se cancela

- **WHEN** se llama `DELETE /api/turnos/:id` sin access token
- **THEN** el sistema responde 401 y el turno no cambia de estado

#### Scenario: Secretaria cancela un turno del consultorio

- **WHEN** una secretaria autenticada cancela un turno `reservado` de su tenant
- **THEN** el sistema responde 200 con el turno en estado `cancelado`

### Requirement: Alcance por rol al cancelar

El sistema SHALL permitir a la secretaria cancelar cualquier turno de su tenant y SHALL limitar al odontólogo a cancelar solo los turnos propios, respondiendo 403 cuando intenta cancelar el de otro profesional.

#### Scenario: Odontólogo cancela su propio turno

- **WHEN** un odontólogo autenticado cancela un turno asignado a él
- **THEN** el sistema responde 200 y el turno queda `cancelado`

#### Scenario: Odontólogo intenta cancelar el turno de otro

- **WHEN** un odontólogo autenticado cancela un turno de otro profesional del mismo tenant
- **THEN** el sistema responde 403 y el turno no cambia de estado

### Requirement: Cancelación interna sin antelación mínima

El sistema SHALL permitir a secretaria y odontólogos cancelar un turno en cualquier momento, sin aplicar la antelación mínima que rige para el link público.

#### Scenario: Interno cancela con menos de la antelación configurada

- **WHEN** una secretaria cancela un turno que comienza dentro de las próximas 24 horas
- **THEN** el sistema responde 200 y el turno queda `cancelado`

### Requirement: Cancelación pública por token

El sistema SHALL exponer sin autenticación `GET /api/turnos/cancelar/:token` para mostrar los datos del turno y `POST /api/turnos/cancelar/:token` para confirmar la cancelación, usando el token del turno como autorización.

#### Scenario: El link muestra el turno a cancelar

- **WHEN** se consulta `GET /api/turnos/cancelar/:token` con un token válido del tenant
- **THEN** el sistema responde 200 con fecha, hora, estado, nombre del paciente y nombre del odontólogo

#### Scenario: El link público confirma la cancelación

- **WHEN** se llama `POST /api/turnos/cancelar/:token` con un token válido del tenant
- **THEN** el sistema responde 200 con el turno en estado `cancelado`

### Requirement: Antelación mínima para la cancelación pública

El sistema SHALL rechazar la cancelación pública cuando falten menos de `CANCEL_MIN_HOURS` horas para el inicio del turno, respondiendo 422 con código `RN-TU-02`, y SHALL leer ese valor del entorno en cada petición con default 24.

#### Scenario: Cancelación pública con antelación suficiente

- **WHEN** faltan 24 horas o más para el inicio y se confirma la cancelación por token
- **THEN** el sistema responde 200 y el turno queda `cancelado`

#### Scenario: Cancelación pública dentro de la ventana bloqueada

- **WHEN** faltan menos de las horas configuradas para el inicio y se confirma la cancelación por token
- **THEN** el sistema responde 422 con código `RN-TU-02` y el turno sigue `reservado`

### Requirement: Cancelación idempotente

El sistema SHALL responder 200 con el turno en estado `cancelado` cuando se repite la cancelación de un turno ya cancelado, sin devolver un error.

#### Scenario: Repetir la cancelación interna

- **WHEN** se cancela por segunda vez un turno ya `cancelado` con `DELETE /api/turnos/:id`
- **THEN** el sistema responde 200 y el estado sigue siendo `cancelado`

#### Scenario: Repetir la cancelación pública

- **WHEN** se repite `POST /api/turnos/cancelar/:token` sobre un turno ya `cancelado`
- **THEN** el sistema responde 200 y el estado sigue siendo `cancelado`

### Requirement: Aislamiento por tenant y token inválido

El sistema SHALL resolver el tenant del canal (token de acceso para internos, tenant de la petición para el link público) y SHALL responder 404 cuando el turno no existe en ese tenant, sin revelar si existe en otro.

#### Scenario: Turno de otro tenant no se cancela

- **WHEN** un usuario del tenant A intenta cancelar por id un turno del tenant B
- **THEN** el sistema responde 404 y el turno del tenant B no cambia de estado

#### Scenario: Token de otro tenant no se cancela

- **WHEN** se usa en el tenant A el token de un turno del tenant B
- **THEN** el sistema responde 404 y el turno del tenant B no cambia de estado

#### Scenario: Token inexistente

- **WHEN** se consulta o se confirma la cancelación con un token que no existe
- **THEN** el sistema responde 404

### Requirement: Datos mínimos en el link público

El sistema SHALL devolver en el link público solo los datos necesarios para confirmar la cancelación y SHALL NOT exponer el teléfono del paciente, `token_cancelacion` ni `password_hash`.

#### Scenario: El link no expone datos sensibles

- **WHEN** se consulta `GET /api/turnos/cancelar/:token` con un token válido
- **THEN** la respuesta no incluye teléfono del paciente, `token_cancelacion` ni `password_hash`

### Requirement: Liberación del slot al cancelar

El sistema SHALL liberar el horario del turno cancelado para que vuelva a ofrecerse en la disponibilidad pública.

#### Scenario: El slot cancelado reaparece en disponibilidad

- **WHEN** un turno se cancela y se consulta la disponibilidad del mismo odontólogo y fecha
- **THEN** el horario del turno cancelado aparece como slot libre
