# Design

## Context

Ver `proposal.md — Why`. Estado actual relevante:

- `frontend/` existe con Vite + React (C-01), punto de entrada `src/main.jsx`, `index.html`, `vite.config.js` en el puerto 5173.
- `backend/` expone `POST /api/auth/login` (C-03) que devuelve `access_token` en body y `refresh_token` en cookie httpOnly/secure/sameSite (path `/api/auth`).
- `backend/` expone `GET /api/agenda` (C-05) autenticado, aislado por `tenant_id` del JWT, con turnos expandidos (paciente + odontólogo).
- `backend/` expondrá `DELETE /api/turnos/:id` (C-06) para cancelar turnos.
- No hay router, ni cliente API, ni guards de ruta en el frontend aún.
- RBAC: `secretaria` ve todos los turnos del tenant; `odontologo` ve solo la propia agenda (matriz en `03_actores_y_roles.md`).

## Goals / Non-Goals

**Goals:**

- Web privada con login (`/login`) y agenda (`/agenda`) para secretaria y odontólogo.
- Access token en memoria (nunca localStorage); refresh en cookie httpOnly/secure/sameSite gestionada por el navegador.
- Guards de ruta por rol; 401 → redirect a `/login`.
- Lista de turnos del día por hora con paciente, filtro por odontólogo, acción cancelar vía `DELETE /api/turnos/:id`.
- Tests E2E mínimos: login secretaria → agenda en <3 clics; login odontólogo → solo suya; anónimo en `/agenda` → redirect login.
- Todo con TypeScript strict, componentes PascalCase, sin `any`.

**Non-Goals:**

- Registro de usuarios, gestión de odontólogos, asignación de profesionales (backend solo).
- Vista semanal, paginación, recordatorios, pagos.
- Endpoints nuevos en el backend: solo consume los existentes de C-03/C-05/C-06.

## Decisions

### 1. Access token en memoria, refresh en cookie httpOnly

El access token se guarda en una variable de módulo (memoria) al hacer login y se inyecta como `Authorization: Bearer <token>` en cada request al backend. Nunca se persiste en `localStorage` ni `sessionStorage` (regla dura). El refresh token viaja solo en cookie httpOnly/secure/sameSite (`/api/auth` path) establecida por el backend en `POST /api/auth/login`; el frontend no lee ni escribe esa cookie directamente.

**Por qué:** cumple la regla dura "NUNCA JWT en localStorage → httpOnly/secure/sameSite" y reduce superficie de XSS.

### 2. Cliente HTTP con interceptores y resolución de tenant desde la sesión

Un cliente `fetch` wrapper añade `Authorization: Bearer <accessToken>` automáticamente. Al recibir 401, redirige a `/login` y limpia el token en memoria. Al recibir 403, muestra mensaje de acceso denegado. El `tenant_id` se lee del JWT decodido (payload) para scopear operaciones; nunca se toma de un query param ni path param (regla dura multi-tenant).

**Por qué:** centraliza auth y tenant; el tenant nunca viene del cliente como parámetro de ruta.

### 3. Guards de ruta por rol en React Router

Se usa React Router con rutas protegidas:

- `/login`: pública, redirige a `/agenda` si ya hay token.
- `/agenda`: privada, requiere autenticación; rol `secretaria` u `odontologo`.
- 401 de cualquier endpoint → redirect a `/login` y limpieza de token.
- El odontólogo ve por defecto su propia agenda; la secretaria ve todas y puede filtrar.

**Por qué:** matriz RBAC de `03_actores_y_roles.md` aplicada en el frontend; 401 → redirect login (req. del scope).

### 4. Página `/agenda`: selector de fecha + filtro odontólogo + lista + cancelar

- Selector de fecha (`<input type="date">`) que consulta `GET /api/agenda?fecha=...`.
- Filtro de odontólogo: secretaria ve lista de odontólogos del tenant y puede filtrar; odontólogo ve la propia por defecto (deshabilitado o preseleccionado).
- Lista por hora con paciente (nombre, teléfono), odontólogo, estado; botón "Cancelar" por turno → `DELETE /api/turnos/:id` con access token.
- Fechas en ISO `-03:00` (Buenos Aires), reutilizando la convención del backend.

**Por qué:** cubre US-003 y las acciones de cancelar del scope.

### 5. TypeScript strict, componentes PascalCase, sin `any`

Todo el frontend nuevo se escribe en TypeScript con `strict: true`, componentes en `PascalCase` y tipado explícito en todas las funciones públicas. No se usa `any` en ningún archivo nuevo.

**Por qué:** reglas duras del proyecto.

## HTTP contract

El frontend consume (no crea) los siguientes endpoints:

| Método | Ruta | Origen | Uso |
|--------|------|--------|-----|
| POST | `/api/auth/login` | C-03 | login email+password; devuelve access_token y setea refresh cookie |
| GET | `/api/agenda?fecha&odontologoId` | C-05 | agenda del día, autenticada, aislada por tenant |
| DELETE | `/api/turnos/:id` | C-06 | cancelar un turno (pendiente de C-06) |

Respuesta de `GET /api/agenda` (de C-05): `{ fecha, odontologoId, turnos: [{ id, inicio, fin, estado, paciente: { id, nombre, telefono }, odontologo: { id, nombre } }] }`, fechas ISO `-03:00`.

Errores manejados por el frontend:

- 401 → redirect `/login`, limpiar token en memoria.
- 403 → mensaje "Acceso denegado" (sin datos expuestos).
- 404 (odontólogo de otro tenant) → mensaje legible.
- 422 (códigos RN) → mensaje de negocio legible.

## Risks / Trade-offs

- **Dependencia de C-06 para cancelar:** `DELETE /api/turnos/:id` no existe hasta que C-06 se archive. Mitigación: desarrollar el botón cancelar con un cliente que apunte al endpoint y conectar al archivar C-06; los tests E2E de cancelar se habilitan tras C-06.
- **Token en memoria se pierde al recargar:** el usuario debe volver a hacer login al refrescar la página. Aceptable en v1 (refresh rota en cookie pero el access token de corta vida no se restaura automáticamente sin endpoint de restore; se documenta).
- **Odontólogo sin vínculo:** si un usuario `odontologo` no tiene `odontologo_id`, el backend de C-05 devuelve 403 `AGENDA_SIN_ODONTOLOGO`; el frontend muestra mensaje claro.
- **No hay refresh silencioso del access token:** el access token dura 15 min; tras expiración, 401 → redirect login. Aceptable para el volumen del consultorio.

## Migration Plan

No hay migración de base de datos (cambio solo frontend). Despliegue:

1. Construir frontend con `npm run build` (Vite).
2. Servir estático junto al backend o en el mismo dominio para que las cookies httpOnly del backend funcionen (mismo host).
3. Verificar que `VITE_API_BASE` apunte al backend del mismo tenant/dominio.

Rollback: retirar las rutas `/login` y `/agenda` y el cliente de auth; el frontend vuelve a la página de foundation de C-01.

## Open questions

- ¿Se agrega un endpoint de restore basado en `POST /api/auth/refresh` para recuperar el access token al recargar la página, o se acepta el re-login? (No bloquea C-08; se decide en v2.)
- ¿El botón cancelar se conecta directamente a `DELETE /api/turnos/:id` de C-06 o hay una capa intermedia? (Se resuelve al archivar C-06.)
