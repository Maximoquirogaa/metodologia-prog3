# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Optimizing PostgreSQL queries, replication, EXPLAIN, JSONB, VACUUM, performance monitoring | postgres-pro | C:\Users\Administrador\.config\opencode\skills\postgres-pro\SKILL.md |
| Building web components, pages, dashboards, React/HTML/CSS UI, styling/beautifying web UI | frontend-design-local | C:\Users\Administrador\.config\opencode\skills\frontend-design-local\SKILL.md |
| Designing APIs, implementing authentication, optimizing DB queries, CI/CD, security, microservices, production backend | backend-development | C:\Users\Administrador\.agents\skills\backend-development\SKILL.md |
| Implementing auth systems, securing APIs, OAuth2/social login, RBAC, session management, debugging auth | auth-implementation-patterns | C:\Users\Administrador\.agents\skills\auth-implementation-patterns\SKILL.md |
| Adding login, sign-up, authentication with Better Auth (new/existing/migrating TS/JS project) | create-auth | C:\Users\Administrador\.agents\skills\create-auth\SKILL.md |
| Writing, reviewing, refactoring React/Next.js code, data fetching, bundle optimization, performance | vercel-react-best-practices | C:\Users\Administrador\.agents\skills\vercel-react-best-practices\SKILL.md |
| Refactoring boolean-prop components, building flexible component libraries, compound components, render props, context | vercel-composition-patterns | C:\Users\Administrador\.agents\skills\vercel-composition-patterns\SKILL.md |
| Automating browser interactions, testing web pages, Playwright tests | playwright-cli | C:\Users\Administrador\.agents\skills\playwright-cli\SKILL.md |
| Testing local web apps with Playwright, verifying frontend, debugging UI, screenshots, browser logs | webapp-testing | C:\Users\Administrador\.agents\skills\webapp-testing\SKILL.md |
| Writing JS/TS tests, test infrastructure, TDD/BDD with Jest, Vitest, Testing Library | javascript-testing-patterns | C:\Users\Administrador\.agents\skills\javascript-testing-patterns\SKILL.md |
| Implementing E2E tests, debugging flaky tests, testing standards with Playwright/Cypress | e2e-testing-patterns | C:\Users\Administrador\.agents\skills\e2e-testing-patterns\SKILL.md |
| /active-orchestrator:* — starting new project from scratch, SDD/OpenSpec foundation flow | active-orchestrator | C:\Users\Administrador\.config\opencode\skills\active-orchestrator\SKILL.md |
| Creating/generating/updating AGENTS.md or CLAUDE.md, project rules, agent instructions, after kb-creator + roadmap-generator | agents-md-generator | C:\Users\Administrador\.config\opencode\skills\agent-instruction\SKILL.md |
| Product/market Discovery before KB: problem, users, competitors, business rules, risks; "investigar mercado", "pensar qué construir" | discovery-research | C:\Users\Administrador\.config\opencode\skills\discovery-research\SKILL.md |
| "how do I do X", "find a skill for X", "is there a skill", extending capabilities | find-skills | C:\Users\Administrador\.config\opencode\skills\find-skill\SKILL.md |
| Creating/building/generating knowledge base, documenting project from source docs, "armar base de conocimiento", "crear KB" | kb-creator | C:\Users\Administrador\.config\opencode\skills\kb-creator\SKILL.md |
| Creating/regenerating CHANGES.md, roadmap, change map, implementation plan, "armar CHANGES/roadmap", "qué changes necesito" | roadmap-generator | C:\Users\Administrador\.config\opencode\skills\roadmap-generator\SKILL.md |
| Creating new skills, modifying/improving skills, measuring performance, evals, benchmarking, description optimization | skill-creator | C:\Users\Administrador\.config\opencode\skills\skill-creator\SKILL.md |

> Note: `discovery-research` exists in both `~/.config/opencode/skills/` and `~/.agents/skills/` (identical content) — deduped to the opencode copy above. `skill-registry` itself is excluded per protocol. Project-level skill dirs (`.claude/skills/`, `.agent/skills/`, `skills/`) contain no SKILL.md — none found.

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### postgres-pro
- Use `EXPLAIN (ANALYZE, BUFFERS)` for every slow query; verify index usage before and after creation
- Prefer `CREATE INDEX CONCURRENTLY` in production; use partial indexes for filtered workloads
- Choose index by workload: B-tree default, GIN for JSONB/containment, GiST for geo, BRIN for append-only
- Run `ANALYZE` after bulk changes; never disable autovacuum globally; tune scale_factor for high-churn tables
- Detect bottlenecks/bloat via `pg_stat_statements` / `pg_stat_user_tables`; monitor lag via `pg_stat_replication`
- Pool connections (pgBouncer); prepared statements; `uuid` type for UUIDs
- Never `SELECT *` in prod; never store large BLOBs in DB; never deploy indexes unverified

### frontend-design-local
- Commit to one bold aesthetic direction before coding; intentionality over intensity
- Typography: distinctive display + refined body; never Inter/Roboto/Arial/system or default Space Grotesk
- Color: cohesive palette via CSS variables; dominant + sharp accent; no purple-gradient-on-white cliché
- Motion: one orchestrated load with staggered reveals; CSS-only preferred, Motion library for React
- Layout: asymmetry/overlap/diagonal/grid-breaking; generous negative space or controlled density
- Backgrounds: meshes, noise, patterns, transparencies, shadows — never flat solid default
- Ship production-grade functional code; match code complexity to the vision

### backend-development
- Stack: Node+TS/NestJS fast dev, Python/FastAPI data, Go/Gin concurrency, Rust/Axum perf; Postgres ACID, Redis cache, Kafka events
- API checklist: schema → input validation (zod/joi) → auth → rate limit → docs → error handling with RN codes (422)
- Security: Argon2id, parameterized queries, OAuth 2.1 + PKCE, short-lived JWT, security headers, rate limiting (OWASP Top 10)
- Performance: Redis cache, indexing, CDN, connection pooling; 70-20-10 test pyramid (unit-integration-E2E)
- Multi-tenant: `resolveTenant()` per request; always scope queries by `tenant_id`
- Deploy: Docker → CI/CD → blue-green/canary + feature flags → Prometheus/Grafana + OpenTelemetry

### auth-implementation-patterns
- Separate AuthN (who) from AuthZ (what); enforce server-side always, never client-only
- JWT access 15-30 min max in httpOnly/secure/sameSite cookies; never localStorage; rotate refresh tokens
- Hash with bcrypt/argon2; never plain passwords; enforce strong password policy
- RBAC via `require_auth` / `require_role secretaria|odontologo` middlewares; validate resource ownership
- Rate-limit auth endpoints (e.g. 5/60s per IP+email); CSRF protection for session auth
- Secure reset with single-use expiring tokens; rotate secrets; log login attempts; prefer MFA

### create-auth
- Plan first: detect framework (next/svelte/nuxt/astro/express/hono), DB/ORM (prisma/drizzle/pg/mysql/sqlite/mongo), package manager
- Install `better-auth` (+ scoped passkey/sso/stripe/scim/expo as needed); set `BETTER_AUTH_SECRET` 32+ chars + `BETTER_AUTH_URL` + `DATABASE_URL`
- Server `lib/auth.ts`: database adapter + `emailAndPassword`/socialProviders + plugins; export Session type
- Client `auth-client.ts`: framework import (react/vue/svelte/solid/vanilla); export signIn/signUp/signOut/useSession
- Routes: Next App `app/api/auth/[...all]/route.ts` via `toNextJsHandler`; Express `toNodeHandler`; SvelteKit hooks; Hono `auth.handler`
- Migrations: Kysely `npx auth migrate`; Prisma generate→migrate dev; Drizzle generate→push (dev) / generate+migrate (prod); re-run after adding plugins
- Harden: `useSecureCookies` in prod, `trustedOrigins`, rate limits, email verification + password reset; never disable CSRF

### vercel-react-best-practices
- Eliminate waterfalls: `Promise.all()` for independent ops, start promises early/await late, Suspense streaming
- Bundle: direct imports (no barrels), `next/dynamic` for heavy, defer third-party, conditional load, preload on hover
- Server: `React.cache()` per-request dedup, LRU cross-request, hoist static IO, minimize RSC→client serialization, parallel fetches
- Client fetching: SWR dedup, passive scroll listeners, versioned minimal localStorage
- Re-renders: memoize expensive subtrees, primitive effect deps, derive during render, `startTransition`/`useDeferredValue`, no inline component defs
- Rendering: `content-visibility` for long lists, hoist static JSX, ternary not `&&`, resource hints, defer/async scripts

### vercel-composition-patterns
- Never add boolean props to customize behavior; compose instead
- Build compound components with shared context for complex UI
- Provider is the only place that knows state implementation; expose generic `{state, actions, meta}` interface
- Lift shared state into provider for sibling access; inject deps via context interface
- Create explicit variant components instead of boolean modes
- Prefer `children` over `renderX` props for composition
- React 19+: no `forwardRef`; use `use()` instead of `useContext()`

### playwright-cli
- Flow: `open [url]` → `goto` → `snapshot` → interact via refs (`click/fill/select/check eN`) → `snapshot` → `close`
- Prefer refs from snapshot; fallback CSS/role/test-id locators; `find "text"` to grep large snapshots
- Forms: `fill eN "value"` (`--submit` for Enter); `press/keydown/keyup` for keys; `upload/drop` for files
- Debug: `console` / `requests` / `request N`, `tracing-start/stop`, `recording-start/stop`, `run-code` for page JS
- Sessions: `-s=name` for parallel browsers; `--mobile/--device` for light snapshots; `--persistent/--profile` for auth; `state-save/load`, cookie/storage cmds
- Artifacts: `screenshot --filename`, `pdf`, `video-start/chapter/stop`; `show --annotate` for user feedback; `generate-locator` for stable selectors
- Windows URLs with `&`: quote + escape (`^&` cmd / `--%` powershell)

### webapp-testing
- Write native Python Playwright scripts with `sync_playwright()`, chromium headless, always `browser.close()`
- Dynamic apps: `goto` → wait `networkidle` BEFORE inspecting DOM/screenshot/selectors
- Static HTML: read file directly for selectors; fall back to dynamic flow if incomplete
- Server mgmt: use `scripts/with_server.py` as black box (`--help` first); single or multi `--server/--port`; don't read source unless customization essential
- Pattern: screenshot/content/locator recon → identify selectors → act with discovered selectors
- Selectors: prefer `text=`/`role=`/IDs; explicit waits (`wait_for_selector`), not blind sleeps

### javascript-testing-patterns
- Stack: Vitest (vite-native, fast) or Jest (ts-jest); Testing Library semantic queries (`getByRole`/`getByPlaceholderText`), `data-testid` sparingly
- Structure AAA, one behavior per test, descriptive names, `beforeEach`/`afterEach` isolation, 80%+ coverage
- Mock externals: `vi.mock` modules, `vi.fn`/`spyOn`, DI repositories; clear mocks per test
- Async: mock fetch responses (`ok`/`json`), `rejects.toThrow` for errors; test success + error paths + edge cases
- Data: faker factories with overrides; truncate tables in `beforeEach`, teardown in `afterAll` for integration (supertest + real test DB)
- Never test implementation details; keep tests fast; TS type-safe tests; mock timers for time logic

### e2e-testing-patterns
- E2E only critical journeys (login/checkout/signup, auth, multi-step, cross-browser, real API); unit/integration for logic/contracts/edge cases
- Pyramid: many unit, fewer integration, few E2E on critical paths
- Selectors: `data-testid`/`data-cy` or role/label; never CSS classes or nth-child chains
- Independence: isolated tests, per-test create/destroy data, no inter-test deps, deterministic (proper waits, no fixed sleeps)
- Speed: mock externals, parallel execution, Page Objects, `test.step` grouping
- Debug: `--headed`/`--debug`/`pause`, trace viewer, screenshot/video on failure

### active-orchestrator
- Thin router only: never implement phase logic, never ask content questions; route to sub-skills
- Own `step`/`version`/`owner` in `.active-orchestrator-state.json`; sub-skills own their sections
- Order: `[discovery-research]?` → kb-creator → roadmap-generator → find-skill → skill-registry → agent-instruction
- Check sub-skill presence before dispatch; offer install, degrade to skip (never abort flow)
- Resume by default if `step != done`; checkpoint at every phase boundary (never chain without explicit Continuar)
- Never auto-install skills; find-skill recommends, user picks at install gate

### agents-md-generator
- Pre-checks: `knowledge-base/` + `02_descripcion_general.md` + README required; CHANGES.md optional (omit roadmap if missing)
- Output `AGENTS.md` + `CLAUDE.md` identical copies at root; never inside `.claude/`/`openspec/`
- Inputs: KB 02 stack table, KB README summary, CHANGES critical path/first change, `.atl/skill-registry.md` as skills truth (fallback scan), KB 10 open questions, global `~/.claude/CLAUDE.md` to avoid duplication
- Rules: stack-aware candidate rules → AskUserQuestion confirm → write only confirmed as `NUNCA X → Y`; reference global, never repeat it
- Skills table maps skill→agent role only; never copy compact rules (they live in registry, unversioned)

### discovery-research
- Idea → what/why before KB; never fill checklist with assumptions — ask or research
- Flow: sources (ask once for URLs/docs; web-scraper per URL → `discovery/sources/<slug>.md`; `collect_sources.py` table) → 11-point Q&A (`references/checklist.md`, 3-5 Qs/round, a/b/c, reject vague) → gate summary + explicit user confirm → write `discovery/discovery.md` + `state.discovery` only
- Reuse scraped facts, don't re-ask; assumption-map risks/open questions (fact vs unproven supposition)
- Governance MEDIA with checkpoints; never write files/state before user confirms summary
- No web-scraper? continue Q&A-only + warn; never build KB (kb-creator consumes this)

### find-skills
- Trigger on how-do-I/is-there-skill/extend-capability; identify domain + task before searching
- Check skills.sh leaderboard first for battle-tested picks (vercel-labs, anthropics, microsoft)
- Search `npx skills find [query] [--owner]`; try specific then alternative terms
- Verify before recommending: 1K+ installs preferred (<100 caution), reputable source, GitHub stars (<100 skepticism)
- Present name + what + installs + source + install cmd + skills.sh link; offer `npx skills add <owner/repo@skill> -g -y`
- None found? help directly + suggest `npx skills init` for custom skill

### kb-creator
- Auto-mode: `docs/` with sources → Mode A silent ingest; else Mode B interactive from scratch
- Output `knowledge-base/` at root (never mix with `docs/`): 10 canonical numbered files + README; extras only `1X_`/`2X_` kebab, never replacing canonicals
- Mode A: read all `docs/` + `state.discovery` if present → extract per canonical-templates → ambiguities to `10_preguntas_abiertas.md` → close with file→lines→topics table
- Mode B: context summary → 3-5 uncertainties → 2-3 approaches pros/cons → 3-5 strategic Qs (P0-sys/scale) → wait → propose structure → iterate file-by-file; mark `Suposición:`
- Orchestrated: write only `state.kb` (discovery 6 fields + source ingest/interactive + files); low-confidence → open questions, never invent

### roadmap-generator
- Pre-checks: `knowledge-base/` + 10 canonicals + `openspec/` exist; else stop with exact missing message
- Output single `CHANGES.md` at root with fixed top-level sections; never add/remove H1/H2 sections
- Read always 04+06+07+08, optionally 03+05+10; group atomic `C-NN` (2-digit, kebab, no us-NNN) into semantic FASEs
- Dependencies: infra C-01 → core models C-02 → auth → referenced-before-referrer → backend-before-coupled-frontend → integrations/payments → admin → visual restyle last
- Gates: fork points with `[Agente A/B/C]`; critical path shortest to prod; 3-agent table balancing load
- Per change: Estado `[ ]` + operational Scope bullets (models/endpoints/migration N/events/tests) + Governance BAJO/MEDIO/ALTO/CRITICO + Leer antes 3-5 KB files with §
- Orchestrated: write only `state.roadmap` (created_by/source/changes IDs)

### skill-creator
- Anatomy: SKILL.md (frontmatter name + pushy description + <500-line body) + `scripts/`/`references/`/`assets/`; progressive disclosure metadata→body→resources
- Capture intent (capability/trigger/output/evals?) → interview edge cases/IO/examples → draft → 2-3 realistic test prompts → user confirms
- Eval loop: with-skill vs baseline subagents parallel → `iteration-N`/eval dirs + `eval_metadata.json` → draft assertions while running → grade (`text`/`passed`/`evidence`) → `aggregate_benchmark` → analyzer pass → `generate_review.py` viewer → read `feedback.json` → generalize (no overfit), keep lean, explain why
- Description optimize: 20 mixed should/should-not trigger evals (tricky near-misses) → user reviews HTML → `run_loop` (60/40 split, 3x runs, ≤5 iters) → apply `best_description` (test-score)
- Never malware/misleading; package via `package_skill`; TodoList tracking

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| _(none)_ | — | No AGENTS.md / CLAUDE.md / .cursorrules / GEMINI.md / copilot-instructions.md yet — conventions section starts empty (expected: agent-instruction runs after registry) |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.

## Project Index (orchestrator context)

- **KB**: `knowledge-base/` (10 canonicals + README) — stack Node + Postgres, domain salud/odontología, turnos/agenda
- **Roadmap**: `CHANGES.md` (C-01…C-08)
- **State**: `.active-orchestrator-state.json` (`skills.installed` = 11 project skills; `registry.file` = `.atl/skill-registry.md`)
- **Installed project skills (11)**: postgres-pro, frontend-design-local, backend-development, auth-implementation-patterns, create-auth, vercel-react-best-practices, vercel-composition-patterns, playwright-cli, webapp-testing, javascript-testing-patterns, e2e-testing-patterns
