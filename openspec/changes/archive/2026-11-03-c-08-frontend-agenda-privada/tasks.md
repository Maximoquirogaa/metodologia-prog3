# Tasks

## 1. Infraestructura de auth y cliente API frontend

- [x] 1.1 Agregar TypeScript al proyecto frontend (`tsconfig.json` strict, plugin de Vite) — verificación: `npm run build` compila sin errores de tipos y `tsc --noEmit` limpio.
- [x] 1.2 Crear cliente HTTP (`src/api/client.ts`) con interceptor que inyecta `Authorization: Bearer <accessToken>` desde memoria, maneja 401 (redirect `/login`) y 403 (acceso denegado) — verificación: unit test que inyecta token y otro que simula 401 y verifica redirect.
- [x] 1.3 Crear store de auth en memoria (`src/auth/store.tsx`): `accessToken`, `user` (id, tenant_id, rol, email), `login(token, user)`, `logout()`, `isAuthenticated()` — verificación: test que confirma que no se escribe en localStorage y que logout limpia la memoria.
- [x] 1.4 Decodificar JWT del access token para obtener `tenant_id` y `rol` (solo lectura, sin verificar firma en cliente) — verificación: test que extrae claims de un token de prueba.

## 2. Página de login y enrutado protegido

- [x] 2.1 Instalar y configurar React Router en `src/main.tsx` con rutas `/login` y `/agenda` — verificación: la app renderiza `/login` por defecto y `/agenda` está registrada.
- [x] 2.2 Crear componente `Login` (`src/pages/Login.tsx`): formulario email+password → `POST /api/auth/login`, guarda access token en memoria, redirige a `/agenda`; errores 401/429 con mensaje legible — verificación: test de login exitoso y de credenciales inválidas.
- [x] 2.3 Crear guard de ruta `RequireAuth` y `RequireRole` por rol (`secretaria`, `odontologo`); 401 → redirect `/login` — verificación: test de ruta protegida sin token redirige a login.
- [x] 2.4 Si ya hay token en memoria, `/login` redirige a `/agenda` — verificación: test de redirección autenticada.

## 3. Página de agenda privada

- [x] 3.1 Crear componente `Agenda` (`src/pages/Agenda.tsx`): selector de fecha, lista de turnos por hora con paciente y odontólogo, consumiendo `GET /api/agenda?fecha` — verificación: test que renderiza turnos ordenados por hora.
- [x] 3.2 Filtro de odontólogo: secretaria ve todos los odontólogos del tenant y puede filtrar; odontólogo ve la propia por defecto — verificación: test de filtro aplicado y test de odontólogo con agenda propia.
- [x] 3.3 Acción cancelar por turno: botón que consume `DELETE /api/turnos/:id` con access token y recarga la agenda — verificación: test que llama al endpoint de cancelar (mock hasta C-06) y test de estado de error 422.
- [x] 3.4 Mostrar mensajes de error de negocio (códigos RN) de forma legible; no exponer `token_cancelation` ni `password_hash` — verificación: test de serialización de respuesta que falla si aparecen campos secretos.

## 4. Guards de rol y aislamiento por tenant

- [x] 4.1 Odontólogo no puede ver agenda de otro profesional: 403 del backend se muestra como acceso denegado — verificación: test de 403 en `/agenda` con odontólogo ajeno.
- [x] 4.2 El tenant se resuelve exclusivamente del JWT (sesión), nunca de un path/query param — verificación: test que confirma que no se envía `tenant_id` en la URL y solo se usa el JWT.
- [x] 4.3 Anónimo en `/agenda` es redirigido a `/login` — verificación: test E2E de navegador.

## 5. Tests E2E y verificación de integración

- [x] 5.1 Test E2E: login secretaria → agenda del día visible en <3 clics — verificación: Playwright corre y pasa.
- [x] 5.2 Test E2E: login odontólogo → solo su agenda (no ve la de otros) — verificación: Playwright corre y pasa.
- [x] 5.3 Test E2E: anónimo en `/agenda` → redirect a `/login` — verificación: Playwright corre y pasa.
- [x] 5.4 Correr `npm run build` y `npm run lint` del frontend — verificación: build y lint limpios.
- [x] 5.5 Contrastar cada escenario de `specs/agenda-turnos/spec.md` con al menos un test y validar cobertura — verificación: matrix de escenarios cubiertos sin huecos.

## Workflow follow-up

- Ejecutar `/opsx:apply c-08-frontend-agenda-privada` para implementar las tareas.
- Actualizar `CHANGES.md` marcando C-08 como archivado tras `/opsx:archive c-08-frontend-agenda-privada`.
