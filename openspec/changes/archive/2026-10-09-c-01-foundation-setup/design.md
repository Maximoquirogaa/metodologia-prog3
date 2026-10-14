# Design — C-01 foundation-setup

## Context

Repo hoy: solo docs (`discovery/`, `knowledge-base/`, `CHANGES.md`, `AGENTS.md`) + `openspec/`. Sin código. Restricciones: Node 20, Postgres 15, multi-tenant por `tenant_id` (RN-MT-01 futura), sin secrets en repo, escalabilidad a nivel modelo. Ver proposal Why y KB 08.

## Goals / Non-Goals

**Goals:** monolito que arranca con `docker compose up`, health verificable, env documentado, CI que frene merges rotos.

**Non-Goals:** modelos de dominio (C-02), auth (C-03), turnos (C-04..C-06), UI real (C-07/C-08), pagos/recordatorios.

## Decisions

- **Express (default) sobre Fastify**: Express más conocido en UTN, menos fricción; se deja puerta a Fastify si validación rinde mejor. Alternativa Fastify: más perf, menos ejemplos locales.
- **Vite+React por defecto (SU-03)**: alinea con `vercel-react-best-practices` y `frontend-design-local`; si el equipo prefiere otro, se cambia en C-07 sin tocar backend.
- **`zod` para validación**: estándar TS, compone con Express; alternativa `joi` (JS clásico) — se instala zod, joi queda como fallback documentado.
- **Docker Compose con 3 servicios (db, backend, frontend)**: reproduce prod mínima local; alternativa DB managed externa — se deja `DATABASE_URL` overridable.
- **CI con 2 jobs paralelos**: backend lint+test, frontend lint+build; bloquea merge si falla.

## Risks / Trade-offs

- [React no confirmado] → Mitigación: scaffolding agnóstico, cambio barato antes de C-07.
- [Puertos/volúmenes locales colisionan] → Mitigación: nombres `odonto-*`, volúmenes nombrados.
- [Over-scaffolding] → Mitigación: solo lo listado en proposal, nada de dominio.

## Migration Plan

No hay migración (greenfield). Rollback: borrar `backend/`, `frontend/`, `docker-compose.yml`, CI. Verificación: `docker compose config`, `GET /api/health` 200, CI en verde.

## Open Questions

- Ninguna que cambie specs/tasks; SU-03 (React) se confirma en C-07.
