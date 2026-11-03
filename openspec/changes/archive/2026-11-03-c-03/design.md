# Design

## Context

Estado actual (ver `proposal.md` para motivación): el backend es un monolito Express (Node 20) con `GET /api/health` público, modelos de dominio en `backend/app/domain/models.js`, infraestructura Postgres en `backend/app/infrastructure/{db,tenant,repositories}`, migraciones en `backend/migrations/` (`001_core_models.sql` de C-02 con tablas Tenant, Odontologo, Paciente, Turno y constraint anti-overlap), scripts `migrate`/`seed` y tests con `node --test`. No existe modelo de usuario, ni emisión/validación de JWT, ni middleware de auth. Las rutas públicas `/`, `/reservar`, `/cancelar/:token` (DD-02) no requieren identidad y así deben seguirlo.

Restricciones que moldean el enfoque:
- Dominio de gobernanza CRÍTICO (autenticación): la implementación no se escribe en este change (solo planificación) y requerirá aprobación explícita antes de tocar código.
- Stack existente sin librería JWT ni de hash: las dependencias nuevas se confirman aquí y se agregan a `backend/package.json`.
- Multi-tenant desde día 1: todo usuario pertenece a un tenant (`tenant_id`), nunca se expone info de otro tenant.
- Sesión stateless: access token JWT corto (15 min), refresh token en cookie HttpOnly/secure/sameSite=lax (7 d).

## Goals / Non-Goals

**Goals:**
- Autenticar usuarios internos (email + password) y emitir JWT access + refresh token.
- Proteger rutas privadas con `require_auth()` y `require_role(...)` según matriz RBAC (`secretaria` / `odontologo`).
- Rotar refresh token y blacklistear tokens revocados (login rate-limit, logout, refresh rotación).
- Mantener rutas públicas `/`, `/reservar`, `/cancelar/:token` sin auth (DD-02).
- Aislamiento por `tenant_id` en toda operación de usuario.

**Non-Goals:**
- Login o sesión de pacientes en v1 (paciente se identifica por nombre+teléfono al reservar, sin cuenta).
- Persistencia del blacklist de tokens fuera del proceso (in-memory; límite documentado como riesgo).
- OAuth, proveedores externos, MFA, restablecimiento de contraseña.
- Aplicar el middleware a rutas concretas de turnos/agenda (lo harán C-04/C-05; este change solo crea el middleware y las rutas `/api/auth/*`).

## Decisions

### 1. Librerías: `jsonwebtoken` para JWT y `bcrypt` para hash de contraseña
**Por qué:** `jsonwebtoken` es estándar en Node/Express, soporta claims personalizados (`sub`, `tenant_id`, `rol`, `email`, `jti`, `type`, `iat`, `exp`) y expiración; `bcrypt` es maduro y suficiente para el MVP (no se justifica argon2 sin requisito específico).
**Alternativas consideradas:** `jose` (más moderno, API diferente, migración innecesaria), `argon2` (mejor resistencia a GPU, pero menor ecosistema en este proyecto y sin requisito).
**Ruta:** agregar a `backend/package.json` y usar solo desde el módulo de auth.

### 2. Modelo y migración: tabla `users` (migración 002)
**Estructura:** `id` UUID PK, `tenant_id` FK → `tenants(id)`, `email` único dentro del tenant (`UNIQUE(tenant_id, email)`), `password_hash`, `rol` enum/check (`secretaria`, `odontologo`), `created_at`.
**Por qué:** reusa el patrón tenant_id de C-02 y el índice compuesto `(tenant_id, email)` ya contemplado en el scope de C-03.
**Alternativa:** email único global — descartada porque el sistema es multi-tenant y dos tenants podrían compartir email.

### 3. Tokens y blacklist
- Access token: JWT firmado, 15 min de vida, claims `sub`, `tenant_id`, `rol`, `email`, `jti`, `type=access`, `iat`, `exp`.
- Refresh token: JWT firmado, 7 días, `type=refresh`, jti único; se envía en cookie HttpOnly/secure/sameSite=lax.
- Blacklist: `Set` de JTIs revocados en memoria (logout y refresh anterior al rotar). Verificado en cada validación de access y refresh.
**Por qué:** simple, sin infra nueva; límite: se pierde al reiniciar (aceptable en MVP, documento en Riesgos).
**Alternativa:** tabla `revoked_tokens` en Postgres — descarta por complejidad desproporcionada en v1.

### 4. Middleware de auth
- `require_auth()`: lee `Authorization: Bearer <access_token>`, verifica firma y expiración, comprueba blacklist del jti, anexa `req.user` (id, tenant_id, rol, email). Responde 401 si falta o es inválido.
- `require_role(...)`: se encadena tras `require_auth` y compara `req.user.rol` con los roles permitidos; 403 si no coincide.
**Dónde:** `backend/app/infrastructure/auth/` (o equivalente dentro del modular monolith `app/infrastructure`); las rutas `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` se registran en el router de Express.
**Rutas públicas:** `/api/health` y las rutas de reserva (`/`, `/reservar`, `/cancelar/:token`) no aplican `require_auth`; este change solo provee el middleware, no lo aplica aún a rutas de turnos/agenda.

### 5. Rate limiting de login
Contador en memoria claveado por `IP + email`, ventana 60 s, máximo 5 intentos; tras exceder, responde 429 hasta que expire la ventana.
**Por qué:** sin dependencias nuevas; límite: contador se reinicia al reiniciar el servidor (documentado).

### 6. Contraseñas
`bcrypt.hash(password, saltRounds=12)` al crear usuario y al hacer login; `bcrypt.compare` para verificar. Nunca se guarda ni devuelve el hash.

### 7. Pruebas
Tests con `node --test` en `backend/test/auth*.test.js`: login correcto, contraseña incorrecta (401), token expirado (401), rotación de refresh, logout, 401 en ruta privada sin token, 403 por rol, aislamiento por tenant, rate limiting. Se agrega migration 002 al conjunto de pruebas de migraciones existentes.

## Risks / Trade-offs

- [Blacklist en memoria se pierde al reiniciar] → Tokens revocados vuelven a ser válidos tras reinicio; aceptable en v1, revisar si se exige revocación persistente.
- [Rate limiter en memoria se reinicia al reiniciar] → Un atacante podría reintentar tras reinicio; mitigación parcial: ventana corta (60 s).
- [Un solo acceso corto + refresh largo] → Robo de refresh cookie da acceso hasta 7 días; mitigación: cookie HttpOnly/secure/sameSite=lax y rotación por uso.
- [Dominio CRÍTICO] → Cualquier fallo en auth expone rutas privadas; la implementación requiere revisión/aprobación explícita y pruebas que cubran los escenarios del spec antes de mezclar.

## Migration Plan

1. Agregar dependencias (`jsonwebtoken`, `bcrypt` + tipos si aplica) a `backend/package.json`.
2. Crear migración 002 (`backend/migrations/002_users.sql`): tabla `users`, FK a `tenants`, índice `UNIQUE(tenant_id, email)`.
3. Ejecutar `backend/scripts/migrate.js` contra la base de datos de desarrollo/staging.
4. Implementar modelo User, repositorio, servicio de auth, rutas `/api/auth/*` y middlewares.
5. Agregar pruebas y ejecutar `npm test` (backend) antes de considerar listo.
**Rollback:** revertir migración 002 (drop table `users`) y quitar dependencias; como ningún middleware se aplica aún a rutas existentes, no hay impacto en rutas ya desplegadas.

## Open Questions

- ¿Entrega del access token en cuerpo de respuesta o en cookie HttpOnly también? (afecta cómo el frontend lo consume en C-07/C-08)
- ¿Nombre exacto de la librería JWT (`jsonwebtoken` vs `jose`) y de hash (`bcrypt` vs `argon2`) — decidir en implementación con aprobación del dueño del dominio CRÍTICO.
