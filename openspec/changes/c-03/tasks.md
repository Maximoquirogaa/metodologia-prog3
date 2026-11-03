# Tasks

## 1. Setup y dependencias

- [x] 1.1 Agregar `jsonwebtoken` y `bcrypt` a `backend/package.json` y verificar que la instalación de dependencias funciona — verificación: `npm install` completa sin errores y `backend/node_modules` contiene ambos paquetes. (Asunción registrada: se usa `jsonwebtoken`+`bcrypt`; el nombre exacto de las librerías se confirma en implementación con aprobación del dominio CRÍTICO, ver design.md Open Questions.)
- [x] 1.2 Crear migración 002 `backend/migrations/002_users.sql` (tabla `users`, FK `tenant_id` → `tenants(id)`, índice `UNIQUE(tenant_id, email)`) — verificación: `npm run migrate` contra la base de desarrollo crea la tabla sin errores.

## 2. Modelo y repositorio de usuario

- [x] 2.1 Agregar modelo `User` a `backend/app/domain/models.js` con `id`, `tenant_id`, `email`, `password_hash`, `rol` (`secretaria`|`odontologo`) y aislamiento por tenant — verificación: prueba unitaria que valide que un usuario pertenece a un solo tenant y que el email es único dentro de su tenant.
- [x] 2.2 Agregar repositorio de usuarios (crear, buscar por email+tenant, buscar por id) en `backend/app/infrastructure/repositories/` — verificación: pruebas de repositorio pasan (crear y recuperar usuario, rechazar email duplicado en mismo tenant).

## 3. Servicio de autenticación (tokens, blacklist, rate limit)

- [x] 3.1 Implementar emisión y verificación de JWT access (claims `sub, tenant_id, rol, email, jti, type, iat, ex
p`, 15 min) y refresh (7 d, cookie HttpOnly/secure/sameSite=lax) — verificación: pruebas unitarias de firma/verificación de tokens y de que los claims esperados están presentes.
- [x] 3.2 Implementar rotación de refresh token y blacklist de JTIs revocados (logout invalida access; refresh anterior se blacklistea al rotar) — verificación: prueba de que tras rotación el refresh anterior es rechazado y tras logout el access token es rechazado.
- [x] 3.3 Implementar rate limiting de login (máximo 5 intentos por ventana de 60 s claveado por IP+email) — verificación: prueba de que el intento 6 dentro de la ventana devuelve 429.

## 4. Rutas y middlewares de auth

- [x] 4.1 Implementar middlewares `require_auth()` y `require_role('secretaria'|'odontologo')` — verificación: ruta privada sin token devuelve 401, rol no permitido devuelve 403, rol permitido prosigue.
- [x] 4.2 Implementar rutas `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` — verificación: login correcto devuelve tokens; contraseña incorrecta devuelve 401; `GET /api/auth/me` con token válido devuelve id, tenant_id, rol y email.
- [x] 4.3 Verificar que rutas públicas (`/api/health`, `/`, `/reservar`, `/cancelar/:token`) no requieren auth (DD-02) — verificación: peticiones sin token a estas rutas no devuelven 401 por auth.

## 5. Pruebas y verificación final

- [x] 5.1 Ejecutar suite completa de tests backend (`npm test` / `node --test`) incluyendo pruebas de migración — verificación: todos los tests pasan.
- [x] 5.2 Ejecutar lint (`npm run lint`) — verificación: lint limpio.
- [x] 5.3 Revisar que las pruebas cubren todos los escenarios de `specs/user-auth/spec.md` — verificación: cada requisito del spec tiene al menos un escenario con una prueba correspondiente.

## Workflow follow-up

- Solicitar aprobación explícita para escribir código de autenticación (dominio CRÍTICO) antes de iniciar cualquier implementación.
- Ejecutar `/opsx:apply c-03` para implementar las tareas.
- Ejecutar `/opsx:archive c-03` para archivar el change tras completarlo y marcar `[x]` en CHANGES.md.
