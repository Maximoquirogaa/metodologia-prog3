# Proposal

## Why

C-03 (auth internos + RBAC) y C-05 (agenda diaria backend) ya están archivados, pero no existe interfaz privada para que la secretaria y el odontólogo vean la agenda del día. El personal del consultorio necesita una web con login donde consultar los turnos del día por hora, filtrar por odontólogo y cancelar turnos, cumpliendo la métrica "agenda del día visible en < 3 clics". Sin este change, US-003 queda sin entrega al usuario final.

## What Changes

- Página `/login` (GET): formulario email+password que llama `POST /api/auth/login`, guarda el access token en memoria (variable JS, nunca localStorage) y el refresh viaja en cookie httpOnly/secure/sameSite establecida por el backend; al éxito redirige a `/agenda`.
- Página `/agenda` (GET): protegida por guard de autenticación; selector de fecha y filtro de odontólogo (secretaria ve todos los del tenant, odontólogo ve la propia por defecto); lista de turnos por hora con paciente; botón cancelar por turno que consume `DELETE /api/turnos/:id` con el access token en `Authorization: Bearer`.
- Guards de ruta por rol según matriz RBAC: `/agenda` solo para `secretaria` y `odontologo`; 401 → redirect a `/login`; 403 → mensaje de acceso denegado.
- Cliente HTTP con interceptors que inyecta el access token como Bearer, maneja 401 (redirect login) y 403 (acceso denegado), y resuelve el tenant desde la sesión (JWT), nunca desde un parámetro de path.
- Tests E2E mínimos (Playwright): login secretaria → agenda visible en <3 clics; login odontólogo → solo su agenda; anónimo en `/agenda` → redirect a `/login`.

## Capabilities

### New Capabilities

- `agenda-privada`: web privada con login para consultar y gestionar la agenda diaria del consultorio, con enrutado protegido por rol, lista de turnos expandidos (paciente + odontólogo), filtro por odontólogo y acción de cancelar turno.

### Modified Capabilities

<!-- Ninguna: es la primera entrega del frontend privado; no altera capacidades existentes de C-04/C-05/C-06/C-07. -->

## Impact

- **Frontend**: nuevas páginas `/login` y `/agenda`, cliente API, store de auth en memoria, guards de ruta; depende del scaffolding `frontend/` existente (Vite + React) de C-01.
- **Contratos HTTP**: consume `POST /api/auth/login` (C-03), `GET /api/agenda` (C-05), `DELETE /api/turnos/:id` (C-06). No crea endpoints nuevos.
- **Seguridad**: access token solo en memoria (nunca localStorage), refresh en cookie httpOnly/secure/sameSite; 401 → redirect login; tenant resuelto del JWT, nunca del path.
- **Dependencias**: C-03 (auth/RBAC) y C-05 (agenda backend) ya archivadas; C-06 (cancelación) provee `DELETE /api/turnos/:id` para la acción cancelar del frontend.

## Dependencies

- C-03 `auth-internos-rbac` (archivado): `POST /api/auth/login`, `require_auth`, `require_role`, JWT claims con `tenant_id` y `rol`.
- C-05 `agenda-diaria` (archivado): `GET /api/agenda` autenticado y aislado por `tenant_id` del JWT.
- C-06 `cancelacion-turnos` (pendiente): `DELETE /api/turnos/:id` para la acción cancelar del frontend. Nota: C-06 es dependencia de comportamiento (no de despliegue) — el botón cancelar apuntará a un endpoint que aún no existe; se puede desarrollar el frontend con un mock y conectar al archivar C-06.
