# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| # | Skill | Trigger (qué hace) | Ruta del proyecto |
|---|-------|--------------------|-------------------|
| 1 | `create-auth` | Auth en TS/JS con Better Auth: detecta framework y ORM, configura adaptadores, rutas, OAuth y páginas de login/signup. | `.agents/skills/create-auth/SKILL.md` |
| 2 | `frontend-design-local` | Interfaces frontend distintivas y de calidad producción: componentes, páginas, dashboards, React/HTML/CSS. Sin estética genérica de IA. | `.agents/skills/frontend-design-local/SKILL.md` |
| 3 | `backend-development` | Diseño de APIs, autenticación, optimización de consultas DB, CI/CD, seguridad, microservices, backend producción. Node/TS, Python, Go, Rust; Postgres ACID, Redis, Kafka. | `.agents/skills/backend-development/backend-api-design.md` |
| 4 | `postgres-pro` | Optimización de consultas PostgreSQL, replicación, EXPLAIN, JSONB, extensiones, VACUUM, monitoreo de rendimiento. | `.agents/skills/postgres-pro/extensions.md` |
| 5 | `auth-implementation-patterns` | Sistemas de autenticación, APIs seguras, OAuth2/social login, RBAC, gestión de sesiones. JWT, bcrypt/argon2, middlewares de rol, rate-limit. | `.agents/skills/auth-implementation-patterns/details.md` |
| 6 | `vercel-react-best-practices` | Escritura/revisión/refactor de código React/Next.js, data fetching, optimización de bundle y rendimiento. | `.agents/skills/vercel-react-best-practices/advanced-init-once.md` |
| 7 | `vercel-composition-patterns` | Refactor de componentes con props booleanos, librerías de componentes flexibles, compound components, render props, context. | `.agents/skills/vercel-composition-patterns/architecture-avoid-boolean-props.md` |
| 8 | `playwright-cli` | Automatización de navegador, pruebas de páginas web, inspección de atributos DOM vía eval, depuración de UI con screenshots y logs. | `.agents/skills/playwright-cli/element-attributes.md` |
| 9 | `webapp-testing` | Pruebas de aplicaciones web locales con Playwright, verificación de frontend, depuración de UI, capturas de pantalla, logs del navegador. | `.agents/skills/webapp-testing/details.md` |
| 10 | `javascript-testing-patterns` | Pruebas JS/TS con Jest/Vitest/Testing Library, TDD/BDD, mocking, fixtures, tests de integración y unitarios, pirámide 70-20-10. | `.agents/skills/javascript-testing-patterns/advanced-testing-patterns.md` |
| 11 | `e2e-testing-patterns` | Pruebas E2E con Playwright/Cypress, depuración de tests flaky, Page Object Model, playwright.config.ts por navegador. | `.agents/skills/e2e-testing-patterns/details.md` |
| 12 | `change-verification-gate` | Gate de verificación por change: corre lint, tests, build, docker + smoke HTTP y specs; devuelve VERDE/AMARILLO/ROJO sin modificar código. Antes de archivar o ante fallas dudosas. | `.agents/skills/change-verification-gate/SKILL.md` |

> Nota: `discovery-research` existe tanto en `~/.config/opencode/skills/` como en `~/.agents/skills/` (contenido idéntico) — se mantiene la copia de opencode. `skill-registry` queda excluido del escaneo por protocolo.

## Compact Rules

Reglas pre-digeridas por skill. Los delegadores copian los bloques correspondientes en los prompts de los sub-agentes como `## Project Standards (auto-resolved)`.

### create-auth
- Detecta framework (Next/Svelte/Nuxt/Astro/Express/Hono) y DB/ORM (Prisma/Drizzle/pg/mysql/sqlite/mongo) antes de instalar
- Instala `better-auth` (+ plugins según necesidad); define `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL`, `DATABASE_URL`
- Servidor `lib/auth.ts`: adaptador de BD + `emailAndPassword`/socialProviders + plugins; exporta Session type
- Cliente `auth-client.ts`: import del framework (react/vue/svelte/solid/vanilla); exporta signIn/signUp/signOut/useSession
- Rutas: Next `app/api/auth/[...all]/route.ts` vía `toNextJsHandler`; Express `toNodeHandler`; SvelteKit hooks; Hono `auth.handler`
- Migraciones: Kysely `npx auth migrate`; Prisma generate→migrate dev; Drizzle generate→push (dev) / generate+migrate (prod)
- Endurece: `useSecureCookies` en prod, `trustedOrigins`, rate limits, verificación de email + reset de contraseña; nunca desactiva CSRF

### frontend-design-local
- Comprométete con una dirección estética clara antes de codificar; intencionalidad sobre intensidad
- Tipografía: display distintivo + cuerpo refinado; nunca Inter/Roboto/Arial/system o Space Grotesk por defecto
- Color: paleta cohesiva con variables CSS; dominante + acento marcado; nada de gradiente morado sobre blanco
- Movimiento: carga orquestada con revelaciones escalonadas; CSS preferido, librería Motion para React
- Diseño: asimetría/superposición/diagonal/romper cuadrícula; espacio negativo generoso o densidad controlada
- Fondos: mallas, ruido, patrones, transparencias, sombras — nunca color sólido plano por defecto
- Código funcional de producción; complejidad del código acorde a la visión

### backend-development
- Stack: Node+TS/NestJS desarrollo rápido, Python/FastAPI datos, Go/Gin concurrencia, Rust/Axum rendimiento; Postgres ACID, Redis caché, Kafka eventos
- Checklist API: esquema → validación de entrada (zod/joi) → auth → rate limit → docs → manejo de errores con códigos RN (422)
- Seguridad: Argon2id, consultas parametrizadas, OAuth 2.1 + PKCE, JWT de corta vida, headers de seguridad, rate limiting (OWASP Top 10)
- Rendimiento: caché Redis, indexación, CDN, pooling de conexiones; pirámide 70-20-10 (unit-integration-E2E)
- Multi-tenant: `resolveTenant()` por request; siempre scopea consultas por `tenant_id`
- Despliegue: Docker → CI/CD → blue-green/canary + feature flags → Prometheus/Grafana + OpenTelemetry

### postgres-pro
- Usa `EXPLAIN (ANALYZE, BUFFERS)` en cada consulta lenta; verifica uso de índice antes y después de crearlo
- Prefiere `CREATE INDEX CONCURRENTLY` en producción; índices parciales para cargas filtradas
- Elige índice según carga: B-tree por defecto, GIN para JSONB/contención, GiST para geo, BRIN para append-only
- Ejecuta `ANALYZE` tras cambios masivos; nunca desactiva autovacuum globalmente; ajusta scale_factor en tablas de alto churn
- Detecta cuellos de botella/bloat vía `pg_stat_statements` / `pg_stat_user_tables`; monitorea lag vía `pg_stat_replication`
- Pool de conexiones (pgBouncer); prepared statements; tipo `uuid` para UUIDs
- Nunca `SELECT *` en prod; nunca BLOBs grandes en BD; nunca despliega índices sin verificar

### auth-implementation-patterns
- Separa AuthN (quién es) de AuthZ (qué puede hacer); aplica siempre en servidor, nunca solo en cliente
- JWT de acceso 15-30 min máximo en cookies httpOnly/secure/sameSite; nunca localStorage; rota refresh tokens
- Hashea con bcrypt/argon2; nunca contraseñas en texto plano; política de contraseñas fuertes
- RBAC vía middlewares `require_auth` / `require_role secretaria|odontologo`; valida propiedad del recurso
- Rate-limit endpoints de auth (ej. 5/60s por IP+email); protección CSRF para sesiones
- Reset seguro con tokens de un solo uso y expiración; rota secretos; registra intentos de login; prefiere MFA

### vercel-react-best-practices
- Elimina cascadas: `Promise.all()` para ops independientes, inicia promesas temprano/espera tarde, Suspense streaming
- Bundle: imports directos (no barriles), `next/dynamic` para pesado, diferido de terceros, carga condicional, preload en hover
- Servidor: `React.cache()` dedup por request, LRU entre requests, hoisteo de IO estático, minimiza serialización RSC→cliente, fetches paralelos
- Inicializa app una vez por carga (guarda a nivel de módulo), no dentro de `useEffect([])` de un componente
- Hook `use()` para promesas/contexto, reemplaza a useEffect para data fetching

### vercel-composition-patterns
- No agregues props booleanos (`isThread`, `isEditing`, `isDMThread`) — cada booleano duplica estados y crea condicionales inmanejables
- Usa composición en lugar de proliferación de props booleanos
- Compound components: separa estado de renderizado, expone contexto implícito
- Render props → prefiere compound components o context para APIs flexibles
- Refactor de props booleanos: reemplaza flags por variantes de componente (ej. `Thread` vs `DMThread`)

### playwright-cli
- Inspecciona atributos de elemento (`id`, `class`, `data-*`) vía `playwright-cli eval "el => el.<attr>" <id-del-elemento>`
- Usa `playwright-cli snapshot` para capturar estado del DOM cuando los atributos están ocultos
- Usa `getComputedStyle(el).<prop>` para inspección de estilo computado vía eval

### webapp-testing
- Verifica funcionalidad del frontend localmente con Playwright
- Captura screenshots y logs del navegador para depurar comportamiento de UI
- Interactúa y prueba aplicaciones web locales de punta a punta

### javascript-testing-patterns
- Escribe pruebas JS/TS con Jest/Vitest/Testing Library; flujos TDD/BDD
- Usa mocking, fixtures; tests de integración + unitarios
- Pirámide de pruebas 70-20-10 (unitario-integración-E2E)

### e2e-testing-patterns
- Implementa pruebas E2E con Playwright/Cypress; depura pruebas flaky
- Patrón Page Object Model para pruebas mantenibles
- Configura `playwright.config.ts` con proyectos por navegador, reintentos y reportes

### change-verification-gate
- Corre `node .agents/skills/change-verification-gate/scripts/verify.mjs --change <name> --mode fast|full`; no arregla nada, solo reporta
- `fast`: preflight Node ≥20 + node_modules, backend lint/test, frontend lint/build, `openspec validate --all`
- `full`: agrega `docker compose up -d --build`, `GET /api/health` y `localhost:5173`; `--cleanup` baja contenedores sin `-v`
- Resuelve el change por `--change` → `openspec list --json` → último archivado; con varios activos, pregunta
- Veredicto: ROJO si hay FAIL; AMARILLO si hay SKIP o tasks pendientes; VERDE solo si todo pasó y tasks completas
- Falla de test: primero `git diff HEAD --stat` / `git ls-tree` / `git log` para saber si es pre-existente; aislar con `git worktree add`; `git stash` es último recurso y nunca con untracked
- Prohibido: modificar código/tests/specs, commitear, usar datos reales de pacientes, exponer `.env`, `docker compose down -v`

## Project Conventions

| Archivo | Ruta | Notas |
|---------|------|-------|
| AGENTS.md | `AGENTS.md` | Índice: stack, KB, skills, roadmap, reglas duras |
| CLAUDE.md | `CLAUDE.md` | Copia de AGENTS.md (el harness lee uno u otro) |
| knowledge-base/02_descripcion_general.md | `knowledge-base/02_descripcion_general.md` | Stack tecnológico (Node 20 + Postgres 15) |
| knowledge-base/05_reglas_de_negocio.md | `knowledge-base/05_reglas_de_negocio.md` | RN-TU / RN-MT |
| knowledge-base/10_preguntas_abiertas.md | `knowledge-base/10_preguntas_abiertas.md` | IN-01 + 5 preguntas abiertas Alta |
| .gitignore | `.gitignore` | `.env` + `node_modules/` |

Lee los archivos de convención listados para los patrones y reglas específicos del proyecto. Todas las rutas referenciadas están extraídas — no hace falta leer archivos de índice para descubrir más.
