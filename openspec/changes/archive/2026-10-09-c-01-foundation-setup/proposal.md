# Proposal — C-01 foundation-setup

## Why

Sin scaffolding base ningún change (C-02..C-08) puede implementarse: hoy no hay backend, frontend, DB local ni CI. C-01 crea el monolito modular mínimo para desbloquear todo el roadmap.

## What Changes

- Estructura `backend/app/{domain,application,infrastructure}/`, `frontend/src/{features,pages}/` según KB 08.
- `backend/` Node 20 + Express (o Fastify) con `GET /api/health`, validación `zod` instalada, config por `.env`.
- `frontend/` scaffolding React (SU-03 a confirmar, se deja Vite+React por defecto) con carpetas `features/reserva`, `features/agenda`.
- `.env.example` con `DATABASE_URL`, `TENANT_DEFAULT=demo`, `CANCEL_MIN_HOURS=24`.
- `docker-compose.yml`: Postgres 15 + backend + frontend para dev local.
- CI mínima: jobs paralelos backend (lint+test) y frontend (lint+build).
- Secrets solo vía `${VAR}`, nunca hardcodeados.

## Capabilities

### New Capabilities

- `platform-foundation`: scaffolding ejecutable del monolito (estructura, health endpoint, env, docker-compose, CI). Dueña del requisito “sistema arranca y reporta salud”.

### Modified Capabilities

- Ninguna (primer change, no hay specs previas).

## Impact

- Crea `backend/`, `frontend/`, `docker-compose.yml`, `.env.example`, CI. Afecta a todos los changes siguientes (dependencia GATE 0). Sin cambios de dominio (RN-TU/MT llegan en C-02).
