# Spec Delta

## Purpose

Entrega la web privada (frontend) para que la secretaria y el odontólogo inicien sesión y vean la agenda del día del consultorio, con paciente y profesional expandidos, filtro por odontólogo, acción de cancelar turno y enrutado protegido por rol, estrictamente acotado al tenant del usuario autenticado.

## ADDED Requirements

### Requirement: Web privada con login

El sistema SHALL exponer una página `/login` (email+password) que autentique al usuario interno, guarde el access token en memoria (nunca en localStorage) y el refresh en cookie httpOnly/secure/sameSite, y redirija a `/agenda`.

#### Scenario: Login exitoso redirige a agenda

- **WHEN** el usuario envía email y password válidos en `/login`
- **THEN** el sistema guarda el access token en memoria, establece la cookie de refresh y redirige a `/agenda`

#### Scenario: Access token nunca se persiste en localStorage

- **WHEN** se completa un login exitoso
- **THEN** no existe ninguna clave en `localStorage` ni `sessionStorage` que contenga el JWT

#### Scenario: Credenciales inválidas

- **WHEN** se envían credenciales incorrectas en `/login`
- **THEN** el sistema responde 401 y muestra un mensaje legible sin redirigir

### Requirement: Agenda del día autenticada y protegida

El sistema SHALL exponer `/agenda` solo para usuarios autenticados con rol `secretaria` u `odontologo`; un anónimo recibe redirect a `/login`.

#### Scenario: Anónimo en agenda es redirigido a login

- **WHEN** un usuario sin sesión accede a `/agenda`
- **THEN** el sistema redirige a `/login`

#### Scenario: Rol habilitado accede a la agenda

- **WHEN** un usuario con rol `secretaria` o `odontologo` con token válido accede a `/agenda`
- **THEN** el sistema responde 200 con la agenda del día

### Requirement: Listado de turnos del día por hora con paciente

El sistema SHALL devolver y renderizar los turnos del día indicado en `fecha`, ordenados por hora de inicio ascendente, incluyendo estados `reservado`, `atendido` y `cancelado`, con paciente (nombre, teléfono) y odontólogo (nombre).

#### Scenario: Turnos ordenados por hora

- **WHEN** la secretaria consulta un día con turnos a las 15:00, 09:00 y 12:00
- **THEN** el sistema los renderiza en orden: 09:00, 12:00, 15:00

#### Scenario: Agenda visible en menos de 3 clics

- **WHEN** la secretaria hace login
- **THEN** la agenda del día está visible en menos de 3 clics desde la pantalla de login

#### Scenario: Día sin turnos devuelve lista vacía

- **WHEN** se consulta un día sin turnos
- **THEN** el sistema muestra una lista vacía con mensaje informativo

### Requirement: Turno expandido sin secretos expuestos

El sistema SHALL renderizar cada turno con `id`, `inicio`, `fin`, `estado`, `paciente` (`nombre`, `telefono`) y `odontologo` (`nombre`), sin exponer `token_cancelation` ni `password_hash`.

#### Scenario: Turno incluye paciente y odontólogo

- **WHEN** la secretaria consulta la agenda de un día con un turno reservado
- **THEN** cada item muestra nombre y teléfono del paciente y nombre del odontólogo

#### Scenario: La agenda no expone tokens de cancelación

- **WHEN** se consulta la agenda de un día con turnos
- **THEN** la respuesta renderizada no incluye `token_cancelation` de ningún turno

### Requirement: Filtro opcional por odontólogo

El sistema SHALL permitir filtrar la agenda por odontólogo: la secretaria ve todos los del tenant; el odontólogo ve la propia por defecto.

#### Scenario: Secretaria filtra por odontólogo

- **WHEN** la secretaria consulta la agenda con el `odontologoId` de un profesional del tenant
- **THEN** la respuesta incluye solo los turnos de ese odontólogo

#### Scenario: Odontólogo ve solo su propia agenda por defecto

- **WHEN** un usuario `odontologo` consulta la agenda sin indicar `odontologoId`
- **THEN** el sistema muestra únicamente los turnos del odontólogo vinculado a su usuario

#### Scenario: Odontólogo no ve agenda de otro profesional

- **WHEN** un usuario `odontologo` intenta ver la agenda de otro profesional
- **THEN** el sistema responde 403 y muestra acceso denegado

### Requirement: Acción cancelar turno

El sistema SHALL permitir cancelar un turno desde la agenda consumiendo `DELETE /api/turnos/:id` con el access token del usuario autenticado.

#### Scenario: Cancelar turno libera el slot

- **WHEN** la secretaria pulsa cancelar en un turno con más de 24h de antelación
- **THEN** el sistema llama `DELETE /api/turnos/:id` y el turno deja de aparecer en la agenda

#### Scenario: Cancelar con menos de 24h se rechaza

- **WHEN** se intenta cancelar un turno con menos de 24h de antelación
- **THEN** el backend responde 422 con código `RN-TU-02` y el frontend muestra el mensaje de negocio

### Requirement: Aislamiento por tenant en el frontend

El sistema SHALL tomar el tenant exclusivamente del access token (sesión) y nunca permitir que se scopee por un parámetro de path o query.

#### Scenario: Tenant resuelto del JWT, no de la URL

- **WHEN** se intenta inyectar un `tenant_id` distinto por query param o path
- **THEN** el frontend lo ignora y usa el `tenant_id` del token

#### Scenario: Turnos de otro tenant no aparecen

- **WHEN** dos tenants tienen turnos el mismo día
- **THEN** la agenda de un usuario solo contiene los turnos de su propio tenant

### Requirement: Manejo de errores de autenticación y autorización

El sistema SHALL manejar 401 (redirect a `/login`, limpiar token) y 403 (mensaje de acceso denegado) de forma consistente.

#### Scenario: 401 redirige a login y limpia token

- **WHEN** cualquier endpoint responde 401
- **THEN** el sistema redirige a `/login` y limpia el access token en memoria

#### Scenario: 403 muestra acceso denegado sin exponer datos

- **WHEN** un endpoint responde 403
- **THEN** el sistema muestra un mensaje de acceso denegado y no renderiza datos
