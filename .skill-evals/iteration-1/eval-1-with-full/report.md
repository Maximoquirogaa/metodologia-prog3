# Gate: c-01-foundation-setup — ROJO

Corrido con `node .agents/skills/change-verification-gate/scripts/verify.mjs --change c-01-foundation-setup --mode full` (Node v24.20.0, Windows, Docker daemon no disponible).

| Etapa | Estado | Tiempo |
|-------|--------|--------|
| preflight:node | FAIL (spurio — bug del script en Windows) | 0.1s |
| preflight:deps | OK | 0.0s |
| backend:lint | OK | 1.1s |
| backend:test | FAIL | 1.2s |
| frontend:lint | OK | 1.3s |
| frontend:build | OK | 16.3s |
| specs:validate | OK | 1.3s |
| docker:up | FAIL (entorno: daemon/WSL2 ausente) | 0.6s |
| smoke:backend | FAIL (entorno: dependía de docker) | 45.6s |
| smoke:frontend | FAIL (entorno: dependía de docker) | 60.8s |

**Tasks**: 8/8 completas (0 pendientes) — `openspec/changes/archive/2026-10-09-c-01-foundation-setup/tasks.md`

**Fallas**
- `backend:test` — `npm test` = `node --test test/`, pero `backend/test/` no existe (nunca estuvo en git): `Could not find 'test/'`. Es un defecto del change: el mismo script lo corre el job `backend` de `.github/workflows/ci.yml`, así que la CI queda en rojo.
- `docker:up` / `smoke:backend` / `smoke:frontend` — no hay daemon de Docker: `failed to connect to the docker API ... dockerDesktopLinuxEngine`, y `wsl --status` indica que WSL2 no está habilitado. No es del change; es entorno. El script lo reporta como FAIL (no SKIP) porque `docker compose version` responde aun sin daemon.
- `preflight:node` — falso negativo del gate: `run()` usa `shell: !IS_WIN`… en Windows lanza `process.execPath` con `shell: true` y la ruta `C:\Program Files\nodejs\node.exe` se corta en `C:\Program`. Node real es v24.20.0 (≥20).

**Lectura**
- `backend:test` es del change y bloquea el archivado (y la CI). No es flaky: se reproduce en cualquier corrida y el directorio no existe en ningún commit.
- Docker es entorno: con WSL2 deshabilitado el stack no puede levantarse en esta máquina. Por regla del gate, sin docker el veredicto no puede ser VERDE; aun arreglando `backend:test` quedaría AMARILLO.
- Smoke manual (sustituto, sin docker): `node src/index.js` → `GET /api/health` = `200 {"status":"ok"}`; `npm run dev` en `frontend/` → `GET http://localhost:5173` = 200. Procesos detenidos después; no quedó nada corriendo.
- Complementos verificados a mano: `docker compose config` válido (exit 0), `.env.example` con `DATABASE_URL`/`TENANT_DEFAULT`/`CANCEL_MIN_HOURS`/`PORT`, `.env` en `.gitignore`, `openspec validate --all` OK.
- Calidad (no bloqueante): `backend:lint` es solo `node --check src/index.js` y `frontend:lint` es un `console.log('lint ok')`; pasan pero no lintean nada real.
- El change ya figura archivado (`openspec/changes/archive/2026-10-09-c-01-foundation-setup`) y `CHANGES.md` lo marca `[x]`. O sea: se archivó sin que este gate pudiera haber dado VERDE.

**Próximo paso**
1. Corregir `backend:test` (crear `backend/test/` con al menos un test, o cambiar el script a `node --test` sin path) y volver a correr el gate.
2. Habilitar WSL2 / arrancar Docker Desktop y repetir en `--mode full` con `--cleanup` para validar el stack real; hasta entonces el techo es AMARILLO.
3. Recién después, archivar (o corregir el estado de archivo si se quiere reabrir el change).

---

## Desvíos respecto de la skill

1. **Change ya archivado**: la skill asume un change activo; se resolvió por `--change` apuntando al directorio en `archive/` (el script lo soporta). Se reporta la inconsistencia con la premisa "antes de archivarlo".
2. **`preflight:node` falseado por el script**: el FAIL es un bug del gate en Windows (`shell: true` + ruta con espacios). Se validó Node a mano (v24.20.0) y se trata la etapa como OK a los efectos de la lectura, sin tocar el script.
3. **Docker ausente**: la skill define SKIP cuando no hay docker; acá el script devolvió FAIL porque `docker compose version` no detecta el daemon caído. Se clasifica como entorno y no se intentó levantar Docker Desktop (requiere WSL2, que no está habilitado).
4. **Smoke manual en lugar de smoke docker**: se levantaron backend y frontend localmente para no quedarse sin evidencia de que la app responde; se detuvieron los procesos. No reemplaza al smoke de contenedores.
5. **No se usó `git stash`** para descartar fallas pre-existentes: está prohibido por las reglas de seguridad de esta corrida y no hacía falta (C-01 es el commit inicial; no hay estado anterior donde el test pudiera pasar).
6. **No se usó `--cleanup`**: no había contenedores levantados y `docker compose down` sin daemon no aporta; no se borró ningún volumen.
7. No se modificó ningún archivo del repo (código, config, specs, tasks). Lo único escrito es este informe.
