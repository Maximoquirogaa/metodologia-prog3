## Gate: c-01-foundation-setup — ROJO

**Pregunta del usuario**: "Me falla el test del backend después de tocar los modelos. ¿Es por lo que cambié o ya estaba roto antes?"
**Respuesta corta**: **ya estaba roto antes** — y además **no hay ningún cambio de modelos en el working tree**. No es tu trabajo.

**Comando corrido**

```
node .agents/skills/change-verification-gate/scripts/verify.mjs --change c-01-foundation-setup --mode fast --json
```

Node v24.20.0 · Windows · Docker **no** invocado (modo fast no lo contempla).
Change resuelto desde `--change`; `openspec list --json` devuelve `changes: []`, así que el gate cae al change archivado `2026-10-09-c-01-foundation-setup`.

| Etapa | Estado | Tiempo |
|-------|--------|--------|
| preflight:node | OK | 0.0s (v24.20.0) |
| preflight:deps | OK | 0.0s |
| backend:lint | OK | 0.8s |
| backend:test | FAIL | 0.8s |
| frontend:lint | OK | 0.9s |
| frontend:build | OK | 13.8s |
| specs:validate | OK | 0.6s |

**Tasks**: 8/8 completas (0 pendientes) — `openspec/changes/archive/2026-10-09-c-01-foundation-setup/tasks.md`

**Fallas**

- `backend:test` — `npm test` corre `node --test test/` y `backend/test/` no existe: `Could not find 'test/'` (única línea de salida). No es un test que falla: es una suite que no existe.

**Lectura**

- **Pre-existente, no introducido.** Determinado sin tocar el árbol (ver sección siguiente).
- **No hay "modelos" que hayan podido romper nada.** `backend/app/domain/` contiene únicamente `.gitkeep`; no existe ningún archivo de modelo en todo el repo (el único match de "model" es `knowledge-base/04_modelo_de_datos.md`). Los modelos son scope de **C-02 core-models-multitenant**, que en `CHANGES.md` sigue `[ ]` **pendiente**. Tocar los modelos hoy implicaría trabajar en un change que todavía no empezó.
- **Es un defecto real de C-01, no del gate.** La task 4.2 pedía CI con job `backend (lint+test)` y `.github/workflows/ci.yml` corre `npm test` tal cual → la CI está en rojo desde el commit inicial `3fe3088`. El change se archivó igual (mismo hallazgo que en eval-2).
- **Caveat de cobertura**: `backend:lint` es `node --check src/index.js`, o sea valida un solo archivo. Cuando C-02 agregue modelos, el lint **no** los va a mirar y el gate podría dar verde con código roto fuera de `index.js`. Vale arreglarlo antes de C-02, no después.
- **Veredicto**: con un FAIL no hay VERDE ni AMARILLO. ROJO. (El techo por tasks abiertas no aplica: 8/8.)

**Cómo lo determiné sin tocar el árbol**

El procedimiento "normal" de la skill (§4 y regla dura de §"Reglas duras") es `git stash` → correr la suite → `git stash pop`. **No lo ejecuté** (regla de seguridad de esta corrida) y resultó **innecesario**, porque había evidencia más fuerte y estrictamente de solo lectura:

1. `git status` → el working tree **no tiene ningún cambio de código**: solo `M .atl/skill-registry.md` (registro de skills, irrelevante para tests) y los directorios untracked `.agents/skills/change-verification-gate/` y `.skill-evals/`. Cero archivos de `backend/` o `frontend/` modificados.
2. `git diff HEAD --stat -- backend frontend` → **vacío**. El código bajo test es byte a byte el de HEAD. Un diff vacío hace que "con stash" y "sin stash" sean la misma ejecución: el stash no aportaría información.
3. `git ls-tree -r --name-only HEAD -- backend` → no existe `backend/test/` en HEAD, y `backend/app/domain/` solo tiene `.gitkeep`.
4. `git log --all --oneline -- backend/test` → **sin resultados**: esa carpeta nunca existió en ningún commit del repo.
5. `git log --all --oneline -- backend/package.json` → un solo commit (`3fe3088`, el inicial). El script `"test": "node --test test/"` nació roto ahí y nunca se tocó.
6. `backend/package.json` apunta a `test/` y el filesystem confirma que no está: la falla es estructural (falta un directorio), no de contenido. Ningún cambio en modelos puede crear ni romper un directorio ausente.

Alternativa de solo lectura si alguna vez el árbol **sí** estuviera sucio: correr la suite contra la baseline en un worktree aparte (`git worktree add` a un temp dir), sin mover ni un byte del árbol principal. No hizo falta acá.

**Próximo paso**

1. Decidir qué se quiere: crear `backend/test/` con al menos un test real (p. ej. `GET /api/health` → 200) **o** cambiar el script a `node --test` sin path. La primera opción es la que pide la task 4.2.
2. Ampliar `backend:lint` para que cubra `src/**` y `app/**`, no solo `src/index.js` — antes de que C-02 traiga modelos.
3. Re-correr `--mode fast`; con 8/8 tasks debería quedar VERDE.
4. Para cerrar de verdad un change: `--mode full --cleanup` con Docker disponible (acá no se pidió y no se hizo).

---

### Nota sobre la skill (para el eval)

- **Sí me llevó a algo destructivo**: §4 (interpretar FAIL de test) dice literalmente "`git stash` del trabajo actual y corré solo esa suite", y la regla dura del gate lo autoriza con restauración en el mismo paso (`git stash` + `git stash pop`). En este caso no lo ejecuté por la restricción de la corrida y porque no hacía falta. Es el punto más frágil de la skill: un `git stash`/`pop` en un árbol sucio con archivos untracked o conflictos puede perder trabajo, y el dueño del código no ve nada de eso en el informe.
- **Mejora propuesta a la skill**: reemplazar ese paso por una escalera de solo lectura antes de sugerir stash: (a) `git status` / `git diff HEAD --stat` acotado a la carpeta de la suite; (b) si el diff relevante está vacío → pre-existente por definición, sin stash; (c) si no, `git worktree add` a un temp dir para la baseline, o `git stash create` (que crea el objeto sin tocar el working tree) en lugar de `git stash`. Y que el informe diga explícitamente qué evidencia se usó para atribuir la falla.
- La skill **sí** acertó en el diagnóstico base: su nota de entorno de Windows ya documenta que `Could not find 'test/'` significa "la carpeta de tests no existe", no "los tests fallan". Ese aviso fue el que guió la lectura correcta.
- Formato del informe (§5) resultó adecuado para este caso; le faltó un lugar explícito para "cómo distinguí pre-existente de introducido", que es justo lo que el usuario pidió.
