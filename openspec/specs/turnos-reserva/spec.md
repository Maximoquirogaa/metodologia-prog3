# turnos-reserva Specification

## Purpose

Permite que un paciente consulte horarios libres y reserve un turno sin autenticarse, garantizando que nunca se asignen dos turnos superpuestos al mismo odontólogo y que la reserva respete el horario de atención del consultorio.

## Requirements

### Requirement: Consulta pública de disponibilidad

El sistema SHALL exponer `GET /api/disponibilidad` sin autenticación, recibiendo `odontologoId` y `fecha`, y devolver la lista de slots libres de 30 minutos dentro del horario de atención, en ISO 8601 con offset `-03:00`.

#### Scenario: Consulta de un día hábil con slots libres

- **WHEN** se consulta la disponibilidad de un odontólogo del tenant para un día hábil futuro sin turnos
- **THEN** el sistema responde 200 con 18 slots de 30 minutos desde 09:00 hasta 17:30 (hora de Buenos Aires)

#### Scenario: Fecha sin horario de atención

- **WHEN** se consulta la disponibilidad para un sábado o domingo
- **THEN** el sistema responde 200 con una lista vacía de slots

### Requirement: Los slots ocupados no se ofrecen

El sistema SHALL excluir de la disponibilidad todo slot que se superponga con un turno del mismo odontólogo en estado `reservado` o `atendido`.

#### Scenario: Slot con turno reservado no aparece

- **WHEN** un odontólogo tiene un turno reservado de 10:00 a 10:30 y se consulta la disponibilidad de ese día
- **THEN** el slot de 10:00 no aparece en la respuesta

#### Scenario: Turno cancelado libera el slot

- **WHEN** el turno que ocupaba el slot de 10:00 está en estado `cancelado`
- **THEN** el slot de 10:00 vuelve a aparecer como disponible

### Requirement: Creación pública de turno

El sistema SHALL exponer `POST /api/turnos` sin autenticación, recibiendo `odontologoId`, `inicio`, `fin` y `paciente` con `nombre` y `telefono`, y crear el turno en estado `reservado` respondiendo 201 con `id`, `estado`, `inicio`, `fin` y `token_cancelacion`.

#### Scenario: Reserva exitosa

- **WHEN** se envía una reserva válida para un slot libre con nombre y teléfono del paciente
- **THEN** el sistema responde 201 y el turno queda en estado `reservado`

#### Scenario: El turno creado ocupa el slot

- **WHEN** se consulta la disponibilidad del mismo día después de una reserva exitosa
- **THEN** el slot reservado ya no aparece entre los disponibles

### Requirement: Reutilización de paciente por teléfono en el tenant

El sistema SHALL reutilizar el paciente existente cuyo teléfono coincide dentro del mismo tenant y crear uno nuevo solo cuando no exista, sin modificar el nombre del registro previo.

#### Scenario: Paciente ya registrado por teléfono

- **WHEN** se reserva con un teléfono que ya existe en el tenant
- **THEN** el turno se asocia al paciente existente y no se crea un duplicado

#### Scenario: Paciente nuevo

- **WHEN** se reserva con un teléfono que no existe en el tenant
- **THEN** el sistema crea el paciente con el nombre y teléfono recibidos y lo asocia al turno

### Requirement: Rechazo de turnos superpuestos

El sistema SHALL rechazar con HTTP 422 y código `RN-TU-01` toda creación de turno cuyo intervalo se superponga con otro turno activo del mismo odontólogo.

#### Scenario: Solapamiento detectado en la aplicación

- **WHEN** se intenta reservar un horario que se superpone con un turno activo del mismo odontólogo
- **THEN** el sistema responde 422 con `code` `RN-TU-01` y no crea el turno

#### Scenario: Reserva concurrente del mismo slot

- **WHEN** dos reservas del mismo slot llegan simultáneamente
- **THEN** una se crea y la otra responde 422 con `code` `RN-TU-01`

### Requirement: Rechazo de turnos fuera del horario de atención

El sistema SHALL rechazar con HTTP 422 y código `RN-TU-04` todo turno que no caiga completo dentro del horario Lun–Vie 09:00–18:00 de Buenos Aires.

#### Scenario: Turno fuera de horario

- **WHEN** se intenta reservar un turno a las 20:00 de un día hábil
- **THEN** el sistema responde 422 con `code` `RN-TU-04` y no crea el turno

#### Scenario: Turno en fin de semana

- **WHEN** se intenta reservar un turno un sábado a las 10:00
- **THEN** el sistema responde 422 con `code` `RN-TU-04` y no crea el turno

### Requirement: Rechazo de reservas sin datos mínimos del paciente

El sistema SHALL rechazar con HTTP 422 y código `RN-TU-03` toda reserva que no incluya nombre y teléfono del paciente.

#### Scenario: Reserva sin teléfono

- **WHEN** se envía una reserva cuyo paciente no tiene teléfono
- **THEN** el sistema responde 422 con `code` `RN-TU-03` y no crea el turno

#### Scenario: Reserva sin nombre

- **WHEN** se envía una reserva cuyo paciente no tiene nombre
- **THEN** el sistema responde 422 con `code` `RN-TU-03` y no crea el turno

### Requirement: Validación de entrada de la reserva

El sistema SHALL responder HTTP 400 cuando faltan parámetros obligatorios o su formato es inválido, sin crear ni modificar datos.

#### Scenario: Fecha con formato inválido

- **WHEN** se consulta la disponibilidad con una `fecha` que no es `YYYY-MM-DD`
- **THEN** el sistema responde 400

#### Scenario: Intervalo inválido

- **WHEN** se envía una reserva con `fin` anterior o igual a `inicio`
- **THEN** el sistema responde 400 y no crea el turno

### Requirement: Aislamiento por tenant en la reserva pública

El sistema SHALL resolver el tenant de la petición y responder 404 cuando el odontólogo solicitado no pertenece a ese tenant, sin revelar la existencia de datos de otros tenants.

#### Scenario: Odontólogo de otro tenant

- **WHEN** se consulta la disponibilidad o se reserva con el `odontologoId` de otro tenant
- **THEN** el sistema responde 404 y no expone datos de ese odontólogo

#### Scenario: Datos creados bajo el tenant de la petición

- **WHEN** se crea un turno sin cabecera de tenant y `TENANT_DEFAULT=demo`
- **THEN** el turno y el paciente quedan asociados al tenant demo

### Requirement: Token de cancelación por turno

El sistema SHALL generar un `token_cancelacion` único y no predecible para cada turno creado, devolverlo solo en la respuesta de creación y no exponerlo en la consulta de disponibilidad.

#### Scenario: Token devuelto al reservar

- **WHEN** se crea un turno correctamente
- **THEN** la respuesta incluye un `token_cancelacion` de al menos 32 caracteres

#### Scenario: Disponibilidad no expone tokens

- **WHEN** se consulta la disponibilidad de un día con turnos
- **THEN** la respuesta no incluye `token_cancelacion` de ningún turno
