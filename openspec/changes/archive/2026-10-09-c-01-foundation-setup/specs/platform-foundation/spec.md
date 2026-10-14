# Spec Delta — platform-foundation

## Purpose

Provee el scaffolding ejecutable del monolito (estructura, health, env, compose, CI) para que el resto de los changes tenga dónde construir.

## ADDED Requirements

### Requirement: Estructura monolito modular
The system SHALL proveer la estructura `backend/app/{domain,application,infrastructure}/` y `frontend/src/{features,pages}/` con `features/reserva` y `features/agenda` creadas.

#### Scenario: Estructura presente
- **WHEN** se lista el repo tras C-01
- **THEN** existen los directorios backend/app y frontend/src con sus subcarpetas

### Requirement: Health endpoint
The system SHALL exponer `GET /api/health` que responde 200 con `{status:"ok"}` sin auth.

#### Scenario: Health OK
- **WHEN** se pide `GET /api/health`
- **THEN** responde 200 y cuerpo con status ok

### Requirement: Config por entorno
The system SHALL leer config desde `.env` con ejemplo versionado `.env.example` que incluye `DATABASE_URL`, `TENANT_DEFAULT=demo`, `CANCEL_MIN_HOURS=24`, sin secrets hardcodeados.

#### Scenario: Env example completo
- **WHEN** se revisa `.env.example`
- **THEN** contiene las 3 variables y ningún secret real

### Requirement: Compose local + CI mínima
The system SHALL proveer `docker-compose.yml` con Postgres 15 + backend + frontend y CI con jobs paralelos backend (lint+test) y frontend (lint+build).

#### Scenario: Compose y CI presentes
- **WHEN** se corre `docker compose config` y se lista CI
- **THEN** el compose valida y existen los dos jobs
