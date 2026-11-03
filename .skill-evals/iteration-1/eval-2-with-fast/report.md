## Gate: c-01-foundation-setup — ROJO

**Comando corrido**

```
node .agents/skills/change-verification-gate/scripts/verify.mjs --change c-01-foundation-setup --mode fast
```

Node v24.20.0 · Windows · Docker **no** invocado (modo fast no lo contempla).

| Etapa | Estado | Tiempo |
|-------|--------|--------|
| preflight:node | OK | 0.0s |
| preflight:deps | OK | 0.0s |
| backend:lint | OK | 0.8s |
| backend:test | FAIL | 0.8s |
| frontend:lint | OK | 0.7s |
| frontend:build | OK | 16.4s |
| specs:validate | OK | 0.6s |

**Tasks**: 8/8 completas (0 pendientes) — `openspec/changes/archive/2026-10-09-c-01-foundation-setup/tasks.md`

**Fallas**

- `backend:test` — `npm test` ejecuta `node --test test/` y `backend/test/` no existe: `Could not find 'test/'`. Salida completa del paso: esa única línea.

**Lectura**

- **Es pre-existente y estructural, no del trabajo en curso.** Verificado sin `git stash` (prohibido en esta corrida y además innecesario): `git ls-files backend` no lista ningún `backend/test/*`, `git log --all -- backend/test` no devuelve commits, y el working tree solo tiene `M .atl/skill-registry.md` + los directorios untracked de la skill y de los evals. O sea: ningún cambio sin commitear pudo romper ese test.
- **Pero sigue siendo un defecto del propio C-01**: la task 4.2 pedía CI con jobs `backend (lint+test)` y `.github/workflows/ci.yml` corre `npm test` tal cual. La CI de este change está en rojo desde el commit inicial, y el change se archivó igual (igual que en el eval-1). Es un FAIL real del gate, no un artefacto: el script solo reporta lo que devuelve el comando.
- **Consecuencia para el veredicto**: no aplica el techo por tasks abiertas (8/8), pero un FAIL nunca puede ser VERDE ni AMARILLO. ROJO.
- **Sobre el pedido "solo backend"**: el modo `fast` de la skill no tiene un selector de etapas; su definición es preflight + backend lint/test + frontend lint/build + specs. Se corrieron las 7 etapas: lo pedido (backend lint+test) tomó 1.6s, el resto (frontend build 16.4s + specs + lint) fue overhead impuesto por el modo. No existe un flag `--only backend`; si el caso de uso "solo tests, rápido, sin docker" se repite, conviene agregarlo al script.
- **Docker**: respetado. No se ejecutó `docker compose`, ni `docker info`, ni smoke HTTP, ni se levantó ningún contenedor. Tampoco quedaron procesos corriendo (el script es `spawnSync` y termina).
- `frontend:build` reescribió `frontend/dist/` (artefacto de build, untracked/ignorado por git); no se tocó código, config, specs ni tasks.

**Próximo paso**

1. Corregir `backend:test`: crear `backend/test/` con al menos un test real, o cambiar el script a `node --test` sin path (y decidir cuál de las dos quiere el proyecto).
2. Volver a correr el gate en `--mode fast` (debería dar VERDE con las 8 tasks ya cerradas).
3. Cuando haya que cerrar de verdad el change, `--mode full --cleanup` con Docker disponible; acá no se pidió y no se hizo.

---

## Modo elegido y por qué

`--mode fast`. El usuario pidió "rápido, sin levantar docker que me come la RAM": `full` agrega `docker compose up -d --build` + espera de backend/frontend + smoke HTTP, exactamente lo que pidió evitar. `fast` es el modo que la skill define para iterar y no toca contenedores. Docker ni se consultó.

## Etapas ejecutadas

preflight (node, deps) → backend lint → backend test → frontend lint → frontend build → specs validate. Total ~19.3s. Sin docker:up, sin smoke:backend, sin smoke:frontend, sin docker:down.

## Veredicto

**ROJO** — 1 fallo (`backend:test`), 0 skips. Fallo pre-existente/estructural del change (no hay `backend/test/`), no introducido por trabajo sin commitear, pero bloquea CI y archivado.

## Desvíos respecto de la skill

1. **No se usó `git stash`** (paso 4 de la skill) para descartar la falla como pre-existente: prohibido por las reglas de seguridad de esta corrida. Se sustituyó con evidencia de git (`ls-files`, `log --all`) que es equivalente o mejor, porque el working tree no tiene cambios en `backend/`.
2. **Se corrieron etapas fuera de lo pedido** (frontend lint/build y specs): no es decisión propia, es lo que hace `--mode fast`. Se reporta para que no se lea como "hice más de lo que pediste" ni como "corrí solo backend".
3. **Change ya archivado**: se apuntó `--change` al directorio en `archive/`; el script lo soporta. La premisa "antes de archivar" no aplica.
4. No se modificó ningún archivo del repo salvo este informe. Sin commit, sin `git add`, sin `checkout`/`reset`, sin Docker, sin procesos residuales.
