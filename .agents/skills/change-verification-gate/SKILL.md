---
name: change-verification-gate
description: Corre la verificación completa del proyecto hasta un change de OpenSpec (lint, tests, build, docker, smoke HTTP y validación de specs) y devuelve un veredicto VERDE/AMARILLO/ROJO sin modificar código. Usala cuando el usuario diga "corré los tests", "verificá que todo funciona", "chequeá el change", "¿está listo para archivar?", "corré el gate" o antes de cada /opsx:archive. También cuando haya que decidir si una falla es del change actual o pre-existente.
---

# Change Verification Gate

Este gate responde una sola pregunta: **¿el proyecto funciona hasta este change?**

No arregla nada. No escribe código. No commitea. Solo ejecuta la verificación, interpreta el resultado y devuelve un veredicto con evidencia. La separación importa: si el mismo agente que implementó también "verifica y arregla", el gate se vuelve teatro. Reportar y corregir son pasos distintos, y quien corrige debe ver el informe antes de tocar nada.

## Cuándo usarla

- Antes de `/opsx:archive` de cualquier change.
- Después de implementar tasks, para saber si el change está realmente cerrado.
- Cuando el usuario pide "correr los tests" o "ver si todo anda".
- Cuando aparece una falla y hay que distinguir si vino con el change o ya estaba.

## Flujo

### 1. Identificar el change objetivo

Por orden de precedencia:

1. El change que pasó el usuario (`--change`).
2. Si no pasó ninguno, `openspec list --json`:
   - exactamente un change activo → ese;
   - ninguno activo → el último directorio en `openspec/changes/archive/` (ordenado por nombre, que arranca con `YYYY-MM-DD`);
   - varios activos → preguntá cuál antes de seguir, no adivines.
3. Confirmá con `openspec status --change "<name>" --json` y guardá `schemaName`, artefactos y si está archivado.

### 2. Leer el alcance y el estado de las tasks

- Abrí `openspec/changes/<name>/tasks.md` (o su copia en `archive/`) y contá `- [x]` vs `- [ ]`.
- Leé la entrada del change en `CHANGES.md` para saber qué capas toca (backend, frontend, DB, docker).
- Las tasks sin marcar no bloquean la ejecución: se informan como advertencia. Un change con tasks abiertas puede tener todo verde y aun así no estar terminado; el veredicto lo refleja.

### 3. Ejecutar el script

```bash
node <skill>/scripts/verify.mjs --change <name> --mode fast
node <skill>/scripts/verify.mjs --change <name> --mode full --cleanup
```

- `--mode fast` (default): preflight, backend lint+test, frontend lint+build, validación de specs. No levanta contenedores. Es el modo para iterar.
- `--mode full`: agrega `docker compose up -d --build`, espera del backend y del frontend, y smoke HTTP. Es el modo para cerrar un change.
- `--cleanup`: baja los contenedores al terminar (sin borrar el volumen de Postgres).
- `--json`: salida machine-readable, útil para pegar en el informe o para que otro agente la parsee.
- `--root <path>`: solo si el script se ejecuta fuera del repo.

El script necesita Node 20+ y no tiene dependencias: no instala nada.

### 4. Interpretar, no solo transcribir

El script dice PASS/FAIL, pero la decisión es tuya:

- **FAIL de lint o build** → es del change. No es flaky. Va al informe con archivo y línea del output.
- **FAIL de test** → antes de culpar al change, verificá si es pre-existente. Escalera, de menos a más invasiva:
  1. `git diff HEAD --stat -- <carpeta>`: si no hay cambios en el código bajo test, con y sin stash daría lo mismo; no hace falta comparar.
  2. `git ls-tree -r HEAD -- <carpeta>` y `git log --all -- <ruta que falla>`: si el archivo o la carpeta nunca existió, la falla es estructural y no del change.
  3. Si el árbol está sucio y de verdad hace falta aislar: `git worktree add <dir-temp> HEAD` y corré ahí. No toca el árbol de trabajo.
  4. Último recurso: `git stash create` (crea el objeto sin modificar el working tree). `git stash` + `git stash pop` solo si no hay untracked y el usuario lo autoriza.
  Si falla igual en HEAD, es pre-existente y se reporta aparte, sin arreglarlo acá.
- **FAIL de smoke HTTP** → revisar contenedores (`docker compose ps`, `docker compose logs <svc> --tail 50`) antes de atribuirlo al código. Un puerto ocupado no es un bug del change.
- **SKIP** → nunca lo cuentes como verde. Si docker no está disponible, el gate no puede afirmar que el sistema levanta; el veredicto baja a AMARILLO aunque el resto pase.

### 5. Informe

Devolvé siempre esta estructura:

```markdown
## Gate: <change> — <VERDE|AMARILLO|ROJO>

| Etapa | Estado | Tiempo |
|-------|--------|--------|
| backend:lint | OK | 0.4s |
| backend:test | FAIL | 2.1s |

**Tasks**: 8/8 completas (o "6/8 — 2 pendientes")

**Fallas**
- `backend:test` — <una línea con la causa raíz>

**Lectura**
- <si es del change, si es pre-existente, si es entorno>

**Próximo paso**
- <archivar / corregir X / repetir en modo full>
```

Reglas del informe: una línea por falla, sin volcar logs enteros (recortá a las 20 líneas relevantes); nunca declares VERDE con SKIPs de docker en modo full; si hay tasks abiertas, el techo del veredicto es AMARILLO.

## Reglas duras del gate

- No modifica código, tests, specs ni configuración. Si algo falla, se reporta.
- No commitea ni hace `git add`. Para comparar contra HEAD prefiere solo lectura (`git diff`, `git ls-tree`, `git log`) o `git worktree add` a un directorio temporal. `git stash` + `git stash pop` es último recurso, nunca con untracked, y solo con autorización del usuario.
- No usa datos reales de pacientes: los smoke tests pegan a endpoints de salud, nunca a datos.
- No expone `.env` ni secretos en el output; si un log los contiene, se recorta.
- No corre migraciones destructivas ni `docker compose down -v`.

## Notas de entorno (Windows)

- `npm`, `openspec` y `docker` viven en el PATH como shims (`npm.cmd`, `openspec.cmd`), por eso el script los invoca con shell en Windows. Un binario con ruta absoluta (`node.exe`) se invoca directo, porque pasar `C:\Program Files\...` por shell corta la ruta en el espacio.
- Si `docker compose version` responde pero `docker info` falla, el daemon no está corriendo (Docker Desktop apagado o WSL2 deshabilitado). El script lo marca SKIP, no FAIL: es entorno, no el change.
- Un FAIL de `backend:test` con `Could not find 'test/'` significa que la carpeta de tests no existe, no que los tests fallen. Es un problema real del proyecto (y de CI), no del gate.
- El lint del backend hoy es `node --check src/index.js`: valida un solo archivo. Un verde de `backend:lint` no cubre los archivos nuevos que agregue un change; si el alcance crece, el script del proyecto tiene que crecer con él.

## Lo que el script cubre hoy

| Etapa | Comando real | Qué prueba |
|-------|--------------|------------|
| preflight | `node -v`, presencia de `node_modules` | entorno listo |
| backend:lint | `npm run lint` en `backend/` | sintaxis |
| backend:test | `npm test` en `backend/` (`node --test`) | unitarios |
| frontend:lint | `npm run lint` en `frontend/` | lint |
| frontend:build | `npm run build` en `frontend/` (`vite build`) | compila |
| specs | `openspec validate --all` | specs válidos |
| docker:up | `docker compose up -d --build` | imágenes construyen |
| smoke:backend | `GET /api/health` | API responde 200 |
| smoke:frontend | `GET http://localhost:5173` | frontend sirve |

Si el proyecto suma etapas (migraciones, seeds, E2E), se agregan en `scripts/verify.mjs` y en esta tabla. La skill y el CI deben contar la misma historia: si `.github/workflows/ci.yml` corre algo que el gate no corre, el gate miente.
