# Spec Delta

## Purpose

Autenticación y autorización de usuarios internos (secretaria y odontólogo) para proteger las rutas privadas del sistema, con emisión y rotación de JWT, cookies de refresh y control de acceso por rol, sin afectar las rutas públicas de reserva v1.

## ADDED Requirements

### Requirement: Internal user identity
The system SHALL persistir usuarios internos con id, tenant_id, email único por tenant, password_hash y rol (`secretaria` o `odontologo`).

#### Scenario: Create a new internal user
- **WHEN** a user record is inserted with a valid tenant_id, email, password_hash and role
- **THEN** the system stores the user and enforces email uniqueness within the same tenant

#### Scenario: Duplicate email in same tenant is rejected
- **WHEN** a user is inserted with an email already registered for the same tenant
- **THEN** the system rejects the insertion due to the `(tenant_id, email)` unique constraint

### Requirement: Internal user login
The system SHALL autenticar un usuario interno con email y password, y al validar credenciales emitir un JWT access de vida corta (15 min) y un refresh token de 7 días en cookie HttpOnly, secure, sameSite=lax.

#### Scenario: Successful login issues tokens
- **WHEN** a user sends valid email and password to `POST /api/auth/login`
- **THEN** the system returns a JWT access token and sets a refresh cookie

#### Scenario: Invalid password fails login
- **WHEN** a user sends a correct email with an incorrect password
- **THEN** the system returns a 401 without issuing tokens

### Requirement: Login rate limiting
The system SHALL limitar intentos de login a 5 por ventana de 60 segundos por IP y email.

#### Scenario: Rate limit blocks excess attempts
- **WHEN** more than 5 login attempts are made for the same IP+email within 60 seconds
- **THEN** the system rejects further attempts until the window expires

### Requirement: Refresh token rotation
The system SHALL rotar el refresh token al renovar el access token: blacklistear el refresh token previo y emitir uno nuevo.

#### Scenario: Refresh rotates and blacklists previous token
- **WHEN** a client presents a valid refresh cookie to `POST /api/auth/refresh`
- **THEN** the system issues a new access token and a new refresh cookie, and blacklists the previous refresh token

### Requirement: Logout blacklists access token
The system SHALL blacklistear el access token activo cuando el usuario cierra sesión.

#### Scenario: Logout invalidates the current access token
- **WHEN** an authenticated user calls `POST /api/auth/logout`
- **THEN** the system blacklists the access token so it can no longer be used

### Requirement: Authenticated user profile
The system SHALL devolver los datos del usuario autenticado (id, tenant_id, rol, email) en `GET /api/auth/me` cuando se presenta un access token válido.

#### Scenario: Get own profile with valid token
- **WHEN** an authenticated user calls `GET /api/auth/me`
- **THEN** the system returns the user's id, tenant_id, rol and email

### Requirement: JWT claims
The system SHALL incluir en cada JWT access los claims `sub`, `tenant_id`, `rol`, `email`, `jti`, `type`, `iat` y `exp`.

#### Scenario: Access token carries required claims
- **WHEN** a JWT access token is issued at login
- **THEN** the token contains claims sub, tenant_id, rol, email, jti, type, iat and exp

### Requirement: Authentication middleware for private routes
The system SHALL rechazar con 401 las peticiones a rutas privadas que no presenten un access token válido y no expirado.

#### Scenario: Private route without token is rejected
- **WHEN** a request to a private route lacks an access token
- **THEN** the system responds 401

#### Scenario: Private route with expired token is rejected
- **WHEN** a request to a private route presents an expired access token
- **THEN** the system responds 401

### Requirement: Role-based authorization
The system SHALL aplicar `require_role('secretaria'|'odontologo')` según la matriz RBAC, permitiendo o denegando acciones según el rol del usuario autenticado.

#### Scenario: Role grants access to permitted action
- **WHEN** a user with role `secretaria` calls an endpoint allowed for secretaria
- **THEN** the system processes the request

#### Scenario: Role denies access to non-permitted action
- **WHEN** a user with role `odontologo` calls an endpoint restricted to secretaria
- **THEN** the system responds 403

### Requirement: Public routes are unauthenticated
The system SHALL NO exigir autenticación en las rutas públicas `/`, `/reservar` y `/cancelar/:token` (DD-02: paciente sin login en v1).

#### Scenario: Public home route is reachable without auth
- **WHEN** an unauthenticated request reaches `/`
- **THEN** the system responds without requiring a token

### Requirement: Tenant-scoped user access
The system SHALL aislar usuarios por tenant_id: un usuario solo puede autenticarse y operar dentro de su propio tenant.

#### Scenario: User belongs to one tenant only
- **WHEN** a user authenticates with email and password
- **THEN** the system scopes the session to the user's tenant_id

## REMOVED Requirements

- Ninguno.
