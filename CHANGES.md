# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **SaaS Odontológico Turnos/Agenda (Node + Postgres)**.
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.**

---

## Cómo usar este documento

1. Identificar el change a implementar (verificar que sus dependencias están en `openspec/changes/archive/`).
2. Leer los docs de la knowledge-base indicados en "Leer antes".
3. Ejecutar `/opsx:propose <nombre-del-change>`.
4. Al terminar el change, archivarlo con `/opsx:archive <nombre-del-change>`.
5. Marcar el checkbox `[x]` en este archivo.

---

## Árbol de dependencias

```
C-01 foundation-setup
  └── C-02 core-models-multitenant
        │
        ├── C-03 auth-internos-rbac          ← desbloquea todo lo privado
        │     └── C-05 agenda-diaria
        │           └── C-08 frontend-agenda-privada *
        │
        └── C-04 disponibilidad-reserva      ← paralelo con C-03 (reserva pública sin login)
              └── C-06 cancelacion-turnos
                    └── C-07 frontend-reserva-publica *
```

> `*` = cualquiera de los dos puede ser el último del camino crítico según qué se demo primero (reserva pública o agenda interna). El mínimo irreducible a producción exige ambos.

### Paralelismo por fase

> Cada "gate" es un punto de sincronización. Los changes dentro de un grupo pueden ejecutarse en paralelo.

```
GATE 0: ninguna
  → C-01 foundation-setup (solo)

GATE 1: C-01 ✓
  → C-02 core-models-multitenant (solo)

GATE 2: C-02 ✓                         ← PRIMER FORK (2 paralelos)
  → C-03 auth-internos-rbac            [Agente A — backend auth]
  → C-04 disponibilidad-reserva        [Agente B — backend turnos]

GATE 3: C-03 ✓ + C-04 ✓                ← SEGUNDO FORK (2 paralelos)
  → C-05 agenda-diaria                 [Agente A — necesita C-03]
  → C-06 cancelacion-turnos            [Agente B — necesita C-04]

GATE 4: C-05 ✓ + C-06 ✓ + C-04 ✓       ← FORK FINAL (2 frontends paralelos)
  → C-07 frontend-reserva-publica      [Agente C — si C-04 + C-06 ✓]
  → C-08 frontend-agenda-privada       [Agente A — si C-05 ✓]
```

### Camino crítico (5 changes — mínimo irreducible)

```
C-01 → C-02 → C-04 → C-06 → C-07
```

> Rama alternativa de igual longitud para valor interno: `C-01 → C-02 → C-03 → C-05 → C-08`. Producción real exige ambas ramas (8 changes totales).

### Plan óptimo con 3 agentes

```
Paso │ Agente A (Backend Core/Auth) │ Agente B (Backend Turnos)      │ Agente C (Frontend)
─────┼──────────────────────────────┼────────────────────────────────┼─────────────────────────────
  1  │ C-01 foundation-setup        │               —                │              —
  2  │ C-02 core-models-multitenant │               —                │              —
  3  │ C-03 auth-internos-rbac      │ C-04 disponibilidad-reserva    │              —
  4  │ C-05 agenda-diaria           │ C-06 cancelacion-turnos        │              —
  5  │ C-08 frontend-agenda-privada │               —                │ C-07 frontend-reserva-publica
```

> Los 3 agentes convergen en el paso 5. Si solo hay 2 agentes, C-07 y C-08 se hacen en secuencia (pasos 5 y 6).

---

## FASE 0 — Cimientos multi-tenant

> C-01 y C-02 son estrictamente secuenciales. Nada más arranca hasta que C-02 está archivado.

### [C-01] `foundation-setup`
- **Estado**: `[x]` archivado (2026-10-09-c-01-foundation-setup)
- **Scope**: Scaffolding completo del monolito modular + infraestructura base
  - Estructura de directorios: `backend/app/{domain,application,infrastructure}/`, `frontend/src/{features,pages}/` según `08_arquitectura_propuesta.md`
  - `backend/`: Node 20 + Express/Fastify app mínima con `GET /api/health`, validación `zod/joi` instalada, config por `.env`
  - `frontend/`: scaffolding web (React a confirmar por SU-03), carpetas `features/reserva`, `features/agenda`, `pages/`
  - `.env.example`: `DATABASE_URL` (sensible), `TENANT_DEFAULT=demo`, `CANCEL_MIN_HOURS=24`
  - `docker-compose.yml`: Postgres 15 + backend + frontend para desarrollo local
  - CI mínima: jobs paralelos backend (lint+test) y frontend (lint+build)
  - Secrets solo vía `${VAR}`, nunca hardcodeados en repo
- **Dependencias**: ninguna
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Alcance v1.0
  - `knowledge-base/02_descripcion_general.md` §Stack tecnológico
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios
  - `knowledge-base/08_arquitectura_propuesta.md` §Variables de entorno

---

### [C-02] `core-models-multitenant`
- **Estado**: `[ ]` pendiente
- **Scope**: Modelos base multi-tenant + constraint anti-overlap + seed demo (US-001…US-004 dependen de estas tablas)
  - Modelos: `Tenant` (id uuid PK, nombre, slug único), `Odontologo` (tenant_id FK, nombre, especialidad, activo), `Paciente` (tenant_id, nombre, teléfono requerido, user_id nullable v1), `Turno` (tenant_id, odontologo_id, paciente_id, inicio/fin timestamptz, estado reservado/cancelado/atendido, token_cancelación)
  - Migración 001: las 4 tablas + FKs + índice `(tenant_id, odontologo_id, inicio)` + índice slug único en tenants
  - Exclusion constraint Postgres en `turnos` por rango `[inicio, fin)` particionado por `odontologo_id` (RN-TU-01 a nivel DB, no solo app)
  - `tenant_id` obligatorio en las 4 tablas de dominio (RN-MT-01); helper/middleware `resolveTenant()` para scoping
  - Seed mínimo: 1 tenant demo, 1 odontólogo Lun–Vie 9–18, 3 pacientes de prueba
  - Tests: aislamiento multi-tenant (un tenant no ve turnos de otro), overlap rechazado a nivel DB, teléfono requerido
- **Dependencias**: C-01
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Entidades
  - `knowledge-base/04_modelo_de_datos.md` §ERD
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio Multi-tenant (RN-MT)
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones aplicados
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-01

---

## FASE 1A — Autenticación de internos

> C-03 puede ir en paralelo con C-04 porque la reserva pública v1 no exige login (DD-02).

### [C-03] `auth-internos-rbac`
- **Estado**: `[ ]` pendiente
- **Scope**: Login solo para internos (secretaria/odontólogo); paciente sin auth en v1
  - Modelo `User`: id, tenant_id FK, email único por tenant, password_hash (bcrypt/argon2), rol (`secretaria`|`odontologo`)
  - Migración 002: tabla `users` + índice `(tenant_id, email)`
  - `POST /api/auth/login` — JWT access (15min) + refresh (7d en cookie HttpOnly, secure, samesite=lax), rate limiting 5 intentos/60s por IP+email
  - `POST /api/auth/refresh` — rotación con blacklist del anterior; `POST /api/auth/logout` — blacklist del access
  - `GET /api/auth/me` — info usuario actual (id, tenant_id, rol, email)
  - Claims JWT: `sub`, `tenant_id`, `rol`, `email`, `jti`, `type`, `iat`, `exp`
  - Middleware `require_auth()` + `require_role('secretaria'|'odontologo')` según matriz RBAC de `03_actores_y_roles.md`
  - Documentar explícitamente: rutas públicas `/`, `/reservar`, `/cancelar/:token` NO pasan por este middleware (DD-02)
  - Tests: login correcto, password incorrecta, token expirado, refresh rotation, secretaria accede a agenda / paciente anónimo recibe 401 en rutas privadas
- **Dependencias**: C-02
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §RBAC — Matriz de permisos
  - `knowledge-base/03_actores_y_roles.md` §Rutas públicas
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-02
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-03

---

## FASE 1B — Dominio de turnos (backend)

> C-04 y C-05/C-06: C-04 es prerrequisito de C-06. C-05 solo necesita C-02+C-03, por lo que va en paralelo con C-06.

### [C-04] `disponibilidad-reserva`
- **Estado**: `[ ]` pendiente
- **Scope**: Disponibilidad + creación de turnos sin login (US-001, US-002; métrica 0 superpuestos)
  - `GET /api/disponibilidad?odontologoId&fecha` — genera slots dentro del horario del odontólogo (Lun–Vie 9–18 seed, RN-TU-04), excluye ocupados; filtra por odontólogo y fecha
  - `POST /api/turnos` — body `{odontologoId, inicio, fin, paciente:{nombre, telefono}}`; crea paciente si no existe (match por teléfono+tenant) y turno en estado `reservado`; devuelve `token_cancelación`
  - Validaciones: overlap por odontólogo → `422 {code:"RN-TU-01"}`; fuera de horario → `422 {code:"RN-TU-04"}`; sin nombre/teléfono → `422 {code:"RN-TU-03"}`; todo error de negocio con código RN y 422 (convención global)
  - Defensa en doble capa: chequeo app + exclusion constraint DB de C-02 como garantía final
  - Tests: slot ocupado no aparece en disponibilidad; doble reserva concurrente del mismo slot → una gana y la otra 422 RN-TU-01; reserva sin teléfono → 422 RN-TU-03; aislamiento por tenant_id
- **Dependencias**: C-02
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Entidades (Turno)
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio Turnos (RN-TU)
  - `knowledge-base/06_funcionalidades.md` §Épica 1 Reserva (US-001, US-002)
  - `knowledge-base/07_flujos_principales.md` §Flujo 1 Reservar turno
  - `knowledge-base/10_preguntas_abiertas.md` §IN-01 (single-tenant inicial con tenant_id)

---

### [C-05] `agenda-diaria`
- **Estado**: `[ ]` pendiente
- **Scope**: Agenda del día para internos autenticados (US-003)
  - `GET /api/agenda?fecha&odontologoId` — requiere auth + rol `secretaria` u `odontologo`; lista turnos del día ordenados por hora con paciente expandido; filtro opcional por odontólogo (si es odontólogo, por defecto solo la propia)
  - Respuesta incluye: hora inicio/fin, paciente (nombre, teléfono), estado, odontólogo
  - Scoping obligatorio por `tenant_id` del JWT (RN-MT-01); nunca exponer teléfonos de otro tenant
  - Tests: lista ordenada por hora con paciente; filtro por odontólogo; odontólogo no ve agenda de otro tenant; anónimo → 401
- **Dependencias**: C-02, C-03
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §RBAC — Matriz de permisos
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio Multi-tenant (RN-MT)
  - `knowledge-base/06_funcionalidades.md` §Épica 2 Agenda (US-003)
  - `knowledge-base/07_flujos_principales.md` §Flujo 2 Ver agenda del día

---

### [C-06] `cancelacion-turnos`
- **Estado**: `[ ]` pendiente
- **Scope**: Cancelación con antelación configurable por link sin login + por internos (US-004, RN-TU-02)
  - `DELETE /api/turnos/:id` — requiere auth (secretaria/odontólogo) o token; valida antelación `CANCEL_MIN_HOURS` (default 24, SU-01 a confirmar) → si `inicio - now < CANCEL_MIN_HOURS` responde `422 {code:"RN-TU-02"}`; si pasa, estado → `cancelado` y libera el slot
  - `GET /cancelar/:token` (info del turno para confirmar) + `POST /api/turnos/cancelar/:token` — cancelación pública por `token_cancelación` sin login (misma validación RN-TU-02)
  - `CANCEL_MIN_HOURS` leído de env en cada request (configurable sin redeploy de código)
  - Tests: cancela con >24h libera slot visible en disponibilidad; cancela con <24h → 422 RN-TU-02; token inválido → 404; token de otro tenant → 404 (no filtrar existencia)
- **Dependencias**: C-04
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio Turnos (RN-TU-02)
  - `knowledge-base/06_funcionalidades.md` §US-004 Cancelar turno
  - `knowledge-base/07_flujos_principales.md` §Flujo 3 Cancelar turno
  - `knowledge-base/08_arquitectura_propuesta.md` §Variables de entorno
  - `knowledge-base/09_decisiones_y_supuestos.md` §SU-01

---

## FASE 2 — Frontend (reserva pública + agenda privada)

> C-07 y C-08 en paralelo una vez que sus backends están archivados. No hay pagos, recordatorios ni integraciones en v1 (fuera de alcance explícito).

### [C-07] `frontend-reserva-publica`
- **Estado**: `[ ]` pendiente
- **Scope**: Web pública sin login: ver disponibilidad, reservar y cancelar por link (métricas: reserva <2min, <3 clics)
  - `GET /` — home + selector odontólogo/fecha + grilla de slots (consume `GET /api/disponibilidad`)
  - `GET /reservar` — formulario nombre+teléfono → `POST /api/turnos`; muestra confirmación + link `/cancelar/:token`
  - `GET /cancelar/:token` — muestra turno y botón confirmar → `POST /api/turnos/cancelar/:token`; estados de error RN-TU-01/02/04 con mensajes legibles
  - Sin login, sin guardar sesión; multi-tenant invisible (tenant resuelto por slug/dominio default `TENANT_DEFAULT`)
  - Tests E2E mínimos: ver slots → reservar → slot desaparece; cancelar con link → slot reaparece
- **Dependencias**: C-04, C-06
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Métricas de éxito
  - `knowledge-base/03_actores_y_roles.md` §Rutas públicas
  - `knowledge-base/06_funcionalidades.md` §Épica 1 Reserva
  - `knowledge-base/07_flujos_principales.md` §Flujo 1 + Flujo 3
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios

---

### [C-08] `frontend-agenda-privada`
- **Estado**: `[ ]` pendiente
- **Scope**: Web privada con login: agenda del día por odontólogo para secretaria/odontólogo
  - `GET /login` — email+password → guarda access token en memoria + refresh en cookie; redirige a `/agenda`
  - `GET /agenda` — selector fecha + filtro odontólogo (secretaria ve todos, odontólogo ve la propia por defecto); lista por hora con paciente; acciones cancelar (consume `DELETE /api/turnos/:id`)
  - Guards de ruta por rol según matriz RBAC; 401 → redirect a `/login`
  - Tests E2E mínimos: login secretaria → agenda del día visible en <3 clics; login odontólogo → solo su agenda; anónimo en `/agenda` → redirect login
- **Dependencias**: C-03, C-05
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Métricas de éxito
  - `knowledge-base/03_actores_y_roles.md` §RBAC — Matriz de permisos
  - `knowledge-base/06_funcionalidades.md` §Épica 2 Agenda (US-003)
  - `knowledge-base/07_flujos_principales.md` §Flujo 2 Ver agenda del día
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad

---
