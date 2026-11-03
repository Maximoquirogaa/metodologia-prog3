# Proposal

## Why

Los usuarios internos (secretaria y odontólogo) necesitan autenticarse para acceder a las rutas privadas del sistema (agenda, gestión de turnos, etc.), mientras que el paciente sigue sin login en v1 (DD-02: reserva pública por nombre+teléfono). Hoy no existe modelo de usuario, ni emisión/validación de JWT, ni middleware de autorización por rol, por lo que cualquier ruta puede ser invocada sin identidad. Este change introduce autenticación de internos con RBAC sencillo para proteger el área privada, sentando la base de C-05 (agenda-diaria) y C-08 (frontend-agenda-privada).

## What Changes

- Nuevo modelo de dominio `User`: id, tenant_id FK, email único por tenant, password_hash (bcrypt/argon2), rol (`secretaria` | `odontologo`).
- Migración 002: tabla `users` con índice `(tenant_id, email)`.
- `POST /api/auth/login`: valida credenciales, emite JWT access (15 min) + refresh (7 días en cookie HttpOnly, secure, sameSite=lax); rate limiting 5 intentos/60 s por IP+email.
- `POST /api/auth/refresh`: rota refresh token con blacklist del anterior.
- `POST /api/auth/logout`: blacklista el access token activo.
- `GET /api/auth/me`: devuelve id, tenant_id, rol, email del usuario autenticado.
- Middleware `require_auth()` y `require_role('secretaria'|'odontologo')` aplicado a rutas privadas según la matriz RBAC de `knowledge-base/03_actores_y_roles.md`.
- Rutas públicas documentadas explícitamente como excluidas del middleware: `/`, `/reservar`, `/cancelar/:token` (DD-02).
- Claims JWT: `sub`, `tenant_id`, `rol`, `email`, `jti`, `type`, `iat`, `exp`.
- Pruebas: login correcto, contraseña incorrecta, token expirado, rotación de refresh, secretaria accede a agenda, paciente anónimo recibe 401 en rutas privadas.

## Capabilities

### New Capabilities

- `user-auth`: Autenticación y autorización de usuarios internos. Cubre registro de identidad (User), emisión/validación/rotación de JWT, cookies de refresh, rate limiting de login, blacklist de tokens revocados, y middleware de autenticación y RBAC por rol para proteger rutas privadas. Cada requisito se declara en `specs/user-auth/spec.md`.

### Modified Capabilities

- Ninguno. Los requisitos existentes de `core-multitenant` y `platform-foundation` no cambian a nivel de spec; este change añade un delta de comportamiento nuevo (autenticación de internos) sin alterar requisitos ya especificados.

## Impact

- `backend/`: nueva tabla `users` (migración 002), nuevas rutas bajo `/api/auth/*`, nuevos middlewares de auth/RBAC, nuevas pruebas de integración y unidad. Dependencias nuevas posibles: librería JWT y de hash (bcrypt/argon2) — a confirmar en design.
- Frontend (C-07/C-08 posterior): consumirá `/api/auth/login`, `/api/auth/me` y enviará el access token en las peticiones privadas.
- Dominio de gobernanza: CRÍTICO (autenticación). El código de implementación no se escribe en este cambio (solo planificación); la implementación requerirá aprobación explícita antes de escribirse, por ser dominio CRÍTICO.
- No se modifican specs existentes (`core-multitenant`, `platform-foundation`); solo se añade la capacidad nueva `user-auth`.
