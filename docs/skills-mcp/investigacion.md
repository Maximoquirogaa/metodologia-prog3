# Ficha de investigación — Skill propia + Servidor MCP

**TP Metodología I** · Equipo: (completar integrantes) · Fecha: 2026-10-29 · Estado: borrador parcial (falta formalizar sección 1)

## 1. Necesidad detectada

> ⚠️ *Pendiente (consigna 1, en clase).* Hipótesis: el C-02 exige migraciones Postgres con exclusion
> constraints (btree_gist), índices compuestos y seed multi-tenant; esa documentación vive fuera del repo
> y consultarla interrumpe al agente — un MCP de docs la resuelve **sin salir del contexto**.

## 2. Change elegido

**C-02 `core-models-multitenant`** (GATE 2; depende solo de C-01, ya archivado): modelos Tenant/Odontólogo/
Paciente/Turno, migración 001 (4 tablas + FKs + índices), exclusion constraint `[inicio, fin)` por
`odontologo_id`, seed demo, tests de aislamiento/overlap. **No depende de funcionalidades inexistentes**
y es preparable íntegramente con la skill propia (revisión de reglas/casos borde) + el MCP elegido
(docs del stack).

## 3. Skill creadora y skill propia

**Creadora: `skill-creator`** (Anthropic). Fuente oficial: `github.com/anthropics/skills/tree/main/skills/skill-creator`
(también plugin oficial de Claude Code). Instalada en OpenCode (`~/.config/opencode/skills/skill-creator/`,
formato Agent Skills); copia local idéntica al upstream (`SKILL.md` + `scripts/` + `eval-viewer/`).
**Disponibilidad:** el skill list del agente la expone en sesión nueva ("use the skill-creator").
**Uso (según su SKILL.md):** propósito → draft → casos de prueba en `evals/evals.json` → benchmark con
`eval-viewer` → iterar.

**Propia del equipo: `change-verification-gate`** (commit `fa06618`, 2026-10-29, Máximo Quiroga) —
`.agents/skills/change-verification-gate/`, registro nº 12 en `.atl/skill-registry.md`:

- **Propósito:** gate "¿el proyecto funciona hasta este change?" (lint, tests, build, docker, smoke HTTP,
  specs) **sin modificar código** — reportar y corregir son pasos separados.
- **Activación:** antes de `/opsx:archive`; tras implementar tasks; "corré los tests"; ante una falla,
  distinguir change vs pre-existente.
- **Entradas:** `--change`, `--mode fast|full`, `--cleanup`, `--json`, `--root`; Node ≥ 20, sin dependencias.
- **Procedimiento:** identificar change (arg → único activo → último archivado) → leer tasks → correr
  `scripts/verify.mjs` → **interpretar** (falla del change vs entorno; escalera de git para pre-existentes).
- **Resultado / criterios:** veredicto VERDE/AMARILLO/ROJO con evidencia por etapa; evals en
  `.skill-evals/iteration-1/` (4 reportes, incl. bug real corregido: preflight spurio en Windows).
  El formato `evals/evals.json` + `iteration-N/report.md` es el de salida de `skill-creator`.

## 4. Comparación de los dos MCP (fuentes oficiales + pruebas empíricas 2026-10-29)

| Dimensión | **A: Context7 MCP** (Upstash) | **B: Playwright MCP** (Microsoft) |
|---|---|---|
| **Propósito** | Docs actualizadas de librerías + snippets en el contexto del agente | Automatización de navegador real vía árbol de accesibilidad |
| **Capacidades** | 2 tools: `resolve-library-id`, `query-docs` | 25 tools por defecto (`browser_*`); ~72 con `--caps=` |
| **Compatibilidad con agente** | OpenCode (`remote`) + Cursor/VS Code/Claude Code/Desktop | OpenCode (`local`) + los mismos clientes |
| **Requisitos instalación/conexión** | Remoto: solo URL (0 descargas); stdio opc., Node ≥ 20.18.1 | Node ≥ 18 + navegador propio instalado (~119 MB) |
| **Permisos** | **Ninguno local**; solo HTTPS saliente a `context7.com` | **Alto privilegio**: navegador, FS del workspace, JS en página; `browser_run_code_unsafe` RCE-equivalent |
| **Credenciales** | Opcionales (anónimo funciona; key `ctx7sk`, OAuth) | Ninguna |
| **Costos** | Free (1.000 calls/mes); Pro $10/seat/mes; Enterprise custom | Gratis (Apache-2.0, sin límites) |

Metodología y evidencia completa (handshakes, ping HTTP 200, 4 tool calls reales, E2E, gotcha de
instalación): `docs/skills-mcp/evidencias/README.md`.

## 5. Elección justificada: Context7 MCP

1. **Cubre el C-02:** docs/snippets de Postgres, Express y Zod — tecnologías del change — dentro del agente.
2. **Riesgo mínimo:** cero permisos locales (el change toca esquemas de BD y credenciales).
3. **Costo y fricción cero:** remote, 0 descargas, sin credenciales obligatorias, ya configurado en el cliente.
4. **Playwright no elegido:** automatización de navegador ya cubierta por las skills `playwright-cli` y
   `webapp-testing`; su uso natural es E2E en C-07/C-08. Candidato futuro.

## 6. Configuración (docs. oficial del servidor y del cliente), conexión y herramienta

**Paso 1 — Cliente OpenCode** (`~/.config/opencode/opencode.json`, según `opencode.ai/docs/mcp-servers/`):
context7 `"type": "remote"` con `"url": "https://mcp.context7.com/mcp"` y `"enabled": true` — sin secretos.
Alternativa stdio: `"type": "local", "command": ["cmd","/c","npx","-y","@upstash/context7-mcp"]`;
API key opcional vía header `CONTEXT7_API_KEY` (nunca en el repo). *Verificado: funciona en esta máquina.*

**Paso 2 — Comprobar la conexión:** (a) `curl https://mcp.context7.com/ping` →
`{"status":"ok","message":"pong"}` (HTTP 200); (b) en OpenCode, sesión nueva → handshake MCP automático
(tools `context7_resolve-library-id` / `context7_query-docs`).

**Paso 3 — Ejecutar una herramienta real** (2026-10-29): `resolve-library-id` → `/websites/zod_dev`,
`/websites/expressjs`; `query-docs` de Express 5 (error handling) → doc con fuente
`expressjs.com/en/5x/guide/error-handling/`. En prompts: patrón oficial *"...use context7"*.

## 7. Qué consulta/modifica y límites para datos de prueba

**Consulta (solo lectura):** docs y snippets del stack (Postgres/SQL, Express, Zod, Node test runner).
**Modifica: nada** — sin side-effects en máquina o repo.
**Límites:** ~40 queries/día (free = 1.000/mes) · ≤ 1 concepto por query · `SQL` para esquemas/índices y
`JavaScript` para API · **prohibidos secrets y datos reales de pacientes en la query** (regla dura del
repo; solo datos sintéticos/demo) · al 429 respetar `Retry-After` · escalado a Pro solo si se superan
1.000/mes sostenidos.

## 8. Archivos de la fundación que prevén actualizar

- `AGENTS.md` / `CLAUDE.md`: sección "Integraciones MCP" — propósito, capacidades, momento de uso y
  límites. *(El MCP NO se registra en `.atl/skill-registry.md`: eso es solo para skills.)*
- `README.md`: documento enlazado con requisitos, pasos, variables de entorno y comprobación (Pasos 1–3).
- `docs/skills-mcp/`: esta ficha + evidencias reproducibles.
- `CHANGES.md`: referencia de preparación de C-02 (consigna 7), sin marcarlo implementado/archivado.

## 9. Fuentes (todas consultadas el 2026-10-29)

**Context7:** github.com/upstash/context7 · context7.com/docs/resources/all-clients · /plans ·
/docs/api-guide · /docs/security/overview · npmjs.com/package/@upstash/context7-mcp
**Playwright:** github.com/microsoft/playwright-mcp · npmjs.com/package/@playwright/mcp
**skill-creator:** github.com/anthropics/skills/tree/main/skills/skill-creator ·
github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator
**Cliente (OpenCode):** opencode.ai/docs/mcp-servers/ (actualizada igual al 2026-10-29)

## 10. Pendientes de verificación

Límites exactos del tier anónimo (visibles solo en dashboard) · stdio de Context7 y API key gratuita no
probados (el remoto anónimo funciona) · el uso de `skill-creator` no figura explícitamente en los commits
(documentada la correspondencia estructural de evals; el equipo lo detalla en la demo).

---

*Requisitos e instrucciones contrastados contra las fuentes de la sección 9; todo lo "verificado" fue
ejecutado en máquina el 2026-10-29 (evidencia reproducible en `docs/skills-mcp/evidencias/`).*
