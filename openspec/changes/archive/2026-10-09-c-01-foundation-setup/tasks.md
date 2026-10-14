# Tasks — C-01 foundation-setup

## 1. Estructura base

- [x] 1.1 Crear `backend/app/{domain,application,infrastructure}/` y `frontend/src/{features/reserva,features/agenda,pages}/` y verificar con `dir` que existen
- [x] 1.2 Inicializar `backend/package.json` Node 20 + Express + zod (+ scripts dev/start/test) y verificar `npm install` ok

## 2. Backend health + env

- [x] 2.1 Implementar `GET /api/health` → 200 `{status:"ok"}` sin auth y verificar con `curl localhost:3000/api/health`
- [x] 2.2 Crear `.env.example` con `DATABASE_URL`, `TENANT_DEFAULT=demo`, `CANCEL_MIN_HOURS=24` sin secrets y verificar que `.env` está en `.gitignore`

## 3. Frontend scaffolding

- [x] 3.1 Scaffold Vite+React en `frontend/` con las carpetas del punto 1.1 y verificar `npm run build` ok

## 4. Compose + CI

- [x] 4.1 Crear `docker-compose.yml` (db Postgres 15 + backend + frontend) y verificar `docker compose config` válido
- [x] 4.2 Agregar CI con jobs paralelos backend (lint+test) y frontend (lint+build) y verificar workflow válido (yaml parse)

## 5. Verificación integral

- [x] 5.1 Levantar `docker compose up --build` y verificar `GET /api/health` 200 + frontend responde 200
