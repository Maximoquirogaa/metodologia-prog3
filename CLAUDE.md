# Sistema Odontológico Turnos/Agenda — Instrucciones para Agentes

> Este archivo (y su copia `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado a partir de `knowledge-base/` y `CHANGES.md`.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Backend | Node.js + Express/Fastify | Node 20 |
| BD | Postgres | 15 |
| Frontend | Web app React (a confirmar) | — |
| Deploy | Docker + Postgres managed | — |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md)

---

## Base de Conocimiento

| Archivo | Cuándo leerlo |
|---------|---------------|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Propósito y alcance v1 |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Auth, RBAC 3 roles |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Tenant, turnos, no-overlap |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | RN-TU/MT |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | US-001..004 |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Reservar, agenda, cancelar |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Monolito multi-tenant, env |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | ⚠️ IN-01 + 5 abiertas Alta |

> ⚠️ Resolver las Alta de `10_preguntas_abiertas.md` (multi-odontólogo, login paciente, 24h) antes del primer change.

---

## Skills Disponibles

| Agente | Rol | Skills que carga |
|--------|-----|------------------|
| Backend Core | Node API, Postgres multitenant | `postgres-pro`, `backend-development`, `javascript-testing-patterns` |
| Backend Auth | JWT, RBAC internos | `auth-implementation-patterns`, `create-auth` |
| Frontend | Reserva pública + agenda privada | `frontend-design-local`, `vercel-react-best-practices`, `vercel-composition-patterns` |
| QA | E2E turnos | `playwright-cli`, `webapp-testing`, `e2e-testing-patterns` |
| Orquestación | SDD/OPSX | `kb-creator`, `roadmap-generator`, `agents-md-generator`, `discovery-research` |

> Los compact rules de cada skill los resuelve el orquestador desde `.atl/skill-registry.md` (generado por `skill-registry`; no versionado — no está en el repo).

---

## Roadmap de Changes

El plan completo está en [CHANGES.md](CHANGES.md). Resumen:
- **Total**: 8 changes en 4 fases (GATE 0–4).
- **Camino crítico**: C-01 → C-02 → C-04 → C-05 → C-06 (reserva pública o agenda según demo).
- **Primer change**: `C-01` foundation-setup.

**Antes de cualquier `/opsx:propose`**: leé CHANGES.md, dependencias y “Leer antes”.

---

## Reglas Duras (específicas del proyecto)

> Sin global `~/.claude/CLAUDE.md` detectado — este proyecto incluye también las universales mínimas. Contrato; romperlas es defecto.

- NUNCA query sin `tenant_id` → scopear siempre por tenant.
- NUNCA `SELECT *` en prod → columnas explícitas + verificar con `EXPLAIN (ANALYZE, BUFFERS)`.
- NUNCA JWT en localStorage → httpOnly/secure/sameSite, refresh rotado.
- NUNCA `any` en TS → strict, componentes PascalCase.
- NUNCA commitear `.env` o secrets → `.env.example` + variables documentadas.
- NUNCA devolver error genérico en reglas de negocio → 422 con código RN (RN-TU-01/02/03/04).
- NUNCA almacenar datos reales de pacientes en el repo ni en ejemplos → usar datos sintéticos/demo.

---

## Flujo de Trabajo

```
1. Leer la KB relevante (knowledge-base/)        → entender dominio
2. Identificar el change en CHANGES.md           → respetar dependencias/GATEs
3. /opsx:propose C-NN-nombre                     → proposal + design + specs + tasks
4. Implementar tasks (cargando skills por rol)   → reglas duras siempre
5. /opsx:archive C-NN-nombre + marcar [x]        → cerrar
```

Ante conflicto KB vs este archivo, prevalecen las reglas duras.
