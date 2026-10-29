#!/usr/bin/env node
/**
 * change-verification-gate / verify.mjs
 *
 * Corre la verificación del proyecto hasta un change de OpenSpec y devuelve
 * un veredicto. No modifica archivos, no instala dependencias, no commitea.
 *
 * Uso:
 *   node verify.mjs [--change <name>] [--mode fast|full] [--root <path>]
 *                   [--cleanup] [--json] [--allow-incomplete]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const IS_WIN = process.platform === "win32";

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const args = { mode: "fast", json: false, cleanup: false, allowIncomplete: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--change") args.change = argv[++i];
    else if (a === "--mode") args.mode = argv[++i];
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--cleanup") args.cleanup = true;
    else if (a === "--allow-incomplete") args.allowIncomplete = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (!["fast", "full"].includes(args.mode)) throw new Error(`Modo inválido: ${args.mode} (usá fast o full)`);
  return args;
}

// ---------------------------------------------------------------- root

function findRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "CHANGES.md")) && existsSync(join(dir, "openspec"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------- process

function run(command, args, cwd, timeoutMs = 300000) {
  const started = Date.now();
  // En Windows, shell solo hace falta para lo que está en el PATH (npm.cmd,
  // openspec.cmd, docker.exe). Un ejecutable con ruta absoluta y espacios
  // (p. ej. C:\Program Files\nodejs\node.exe) se rompe si se pasa por shell,
  // así que ahí se invoca directo.
  const needsShell = IS_WIN && !isAbsolute(command);
  const res = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    shell: needsShell,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const durationMs = Date.now() - started;
  const timedOut = res.error?.code === "ETIMEDOUT";
  const spawnError = res.error && !timedOut ? res.error.message : null;
  const ok = !res.error && res.status === 0;
  return {
    ok,
    status: res.status,
    durationMs,
    timedOut,
    spawnError,
    stdout: (res.stdout || "").toString(),
    stderr: (res.stderr || "").toString(),
  };
}

function tail(text, lines = 20) {
  const clean = text.trim();
  if (!clean) return "";
  const parts = clean.split(/\r?\n/);
  return parts.length > lines ? parts.slice(-lines).join("\n") : clean;
}

// ---------------------------------------------------------------- change

function readJsonCommand(command, args, cwd) {
  const res = run(command, args, cwd, 30000);
  if (!res.ok) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

function resolveChange(root, explicit) {
  if (explicit) return { name: explicit, source: "arg" };

  const listing = readJsonCommand("openspec", ["list", "--json"], root);
  const active = listing?.changes ?? [];
  if (active.length === 1) return { name: active[0].name ?? active[0], source: "openspec-list" };
  if (active.length > 1) {
    return {
      name: null,
      source: "ambiguous",
      candidates: active.map((c) => c.name ?? c),
    };
  }

  const archiveDir = join(root, "openspec", "changes", "archive");
  if (existsSync(archiveDir)) {
    const dirs = readdirSync(archiveDir)
      .filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d))
      .sort();
    if (dirs.length) {
      return {
        name: dirs[dirs.length - 1].replace(/^\d{4}-\d{2}-\d{2}-/, ""),
        archiveDir: dirs[dirs.length - 1],
        source: "archive",
      };
    }
  }
  return { name: null, source: "none" };
}

function findTasksFile(root, change) {
  const candidates = [
    join(root, "openspec", "changes", change, "tasks.md"),
  ];
  const archiveDir = join(root, "openspec", "changes", "archive");
  if (existsSync(archiveDir)) {
    for (const d of readdirSync(archiveDir)) {
      if (d.endsWith(change)) candidates.push(join(archiveDir, d, "tasks.md"));
    }
  }
  return candidates.find((p) => existsSync(p)) ?? null;
}

function countTasks(file) {
  if (!file) return null;
  const text = readFileSync(file, "utf8");
  const done = (text.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
  const pending = (text.match(/^\s*-\s*\[\s\]/gm) || []).length;
  return { done, pending, total: done + pending };
}

// ---------------------------------------------------------------- steps

function step(id, label, fn) {
  return { id, label, fn };
}

function commandStep(id, label, cwd, command, args, timeoutMs) {
  return step(id, label, () => {
    const r = run(command, args, cwd, timeoutMs);
    return {
      status: r.ok ? "OK" : r.timedOut ? "FAIL" : r.spawnError ? "SKIP" : "FAIL",
      durationMs: r.durationMs,
      detail: r.ok ? "" : r.timedOut ? `timeout tras ${timeoutMs}ms` : r.spawnError || tail(r.stderr || r.stdout),
    };
  });
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let last = "sin respuesta";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.status >= 200 && res.status < 400) {
        return { ok: true, status: res.status, durationMs: Date.now() - started };
      }
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err?.name === "TimeoutError" ? "timeout de request" : String(err?.message ?? err);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { ok: false, detail: `${last} (${timeoutMs}ms)`, durationMs: Date.now() - started };
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n/, ""));
    return 0;
  }

  const root = args.root ? resolve(args.root) : findRoot(HERE);
  if (!root) {
    console.error("No encontré la raíz del proyecto (CHANGES.md + openspec/). Usá --root <path>.");
    return 2;
  }

  const change = resolveChange(root, args.change);
  if (!change.name) {
    if (change.source === "ambiguous") {
      console.error(`Hay varios changes activos: ${change.candidates.join(", ")}. Pasá --change <name>.`);
    } else {
      console.error("No encontré ningún change activo ni archivado.");
    }
    return 2;
  }

  const tasks = countTasks(findTasksFile(root, change.name));
  const backend = join(root, "backend");
  const frontend = join(root, "frontend");
  const steps = [];

  // preflight
  steps.push(
    step("preflight:node", "preflight: node", () => {
      // process.versions.node evita spawnear node con una ruta que puede tener
      // espacios y evita un falso FAIL por cómo se invoca el binario.
      const version = process.versions.node;
      const major = Number(version.split(".")[0]);
      return {
        status: major >= 20 ? "OK" : "FAIL",
        durationMs: 0,
        detail: major >= 20 ? `v${version}` : `v${version} (se requiere >=20)`,
      };
    })
  );

  steps.push(
    step("preflight:deps", "preflight: dependencias", () => {
      const missing = [
        !existsSync(join(backend, "node_modules")) && "backend/node_modules",
        !existsSync(join(frontend, "node_modules")) && "frontend/node_modules",
      ].filter(Boolean);
      return {
        status: missing.length ? "FAIL" : "OK",
        durationMs: 0,
        detail: missing.length ? `falta ${missing.join(", ")} — corré npm install en cada carpeta` : "",
      };
    })
  );

  if (existsSync(join(backend, "package.json"))) {
    steps.push(commandStep("backend:lint", "backend: lint", backend, NPM, ["run", "lint"], 120000));
    steps.push(commandStep("backend:test", "backend: test", backend, NPM, ["test"], 300000));
  }

  if (existsSync(join(frontend, "package.json"))) {
    steps.push(commandStep("frontend:lint", "frontend: lint", frontend, NPM, ["run", "lint"], 120000));
    steps.push(commandStep("frontend:build", "frontend: build", frontend, NPM, ["run", "build"], 300000));
  }

  // specs
  steps.push(
    step("specs:validate", "specs: validate", () => {
      const probe = run("openspec", ["--version"], root, 15000);
      if (!probe.ok) return { status: "SKIP", durationMs: probe.durationMs, detail: "openspec CLI no disponible" };
      const r = run("openspec", ["validate", "--all"], root, 60000);
      return {
        status: r.ok ? "OK" : "FAIL",
        durationMs: r.durationMs,
        detail: r.ok ? "" : tail(r.stderr || r.stdout),
      };
    })
  );

  if (args.mode === "full") {
    // `docker compose version` funciona aunque el daemon esté apagado; sin
    // `docker info` el gate culparía al change de un entorno sin Docker.
    const composeCheck = run("docker", ["compose", "version"], root, 20000);
    const daemonCheck = composeCheck.ok ? run("docker", ["info"], root, 30000) : null;
    const dockerReady = composeCheck.ok && Boolean(daemonCheck?.ok);
    if (!dockerReady) {
      const why = !composeCheck.ok
        ? "docker compose no disponible"
        : "daemon de Docker no disponible (¿Docker Desktop apagado o WSL2 deshabilitado?)";
      steps.push(step("docker:up", "docker: up", () => ({
        status: "SKIP",
        durationMs: (composeCheck.durationMs ?? 0) + (daemonCheck?.durationMs ?? 0),
        detail: why,
      })));
      steps.push(step("smoke:backend", "smoke: backend", () => ({
        status: "SKIP",
        durationMs: 0,
        detail: "sin Docker no hay contenedor que probar",
      })));
      steps.push(step("smoke:frontend", "smoke: frontend", () => ({
        status: "SKIP",
        durationMs: 0,
        detail: "sin Docker no hay contenedor que probar",
      })));
    } else {
      steps.push(
        step("docker:up", "docker: up", () => {
          const r = run("docker", ["compose", "up", "-d", "--build"], root, 600000);
          return { status: r.ok ? "OK" : "FAIL", durationMs: r.durationMs, detail: r.ok ? "" : tail(r.stderr || r.stdout) };
        })
      );
      steps.push(
        step("smoke:backend", "smoke: backend", async () => {
          const r = await waitForHttp("http://localhost:3000/api/health", 45000);
          return { status: r.ok ? "OK" : "FAIL", durationMs: r.durationMs, detail: r.ok ? `HTTP ${r.status}` : r.detail };
        })
      );
      steps.push(
        step("smoke:frontend", "smoke: frontend", async () => {
          const r = await waitForHttp("http://localhost:5173", 60000);
          return { status: r.ok ? "OK" : "FAIL", durationMs: r.durationMs, detail: r.ok ? `HTTP ${r.status}` : r.detail };
        })
      );
      if (args.cleanup) {
        steps.push(
          step("docker:down", "docker: down", () => {
            const r = run("docker", ["compose", "down"], root, 120000);
            return { status: r.ok ? "OK" : "FAIL", durationMs: r.durationMs, detail: r.ok ? "" : tail(r.stderr) };
          })
        );
      }
    }
  }

  const results = [];
  for (const s of steps) {
    const r = await s.fn();
    results.push({ id: s.id, label: s.label, ...r });
  }

  const failures = results.filter((r) => r.status === "FAIL");
  const skips = results.filter((r) => r.status === "SKIP");
  const incomplete = args.allowIncomplete ? 0 : tasks?.pending ?? 0;

  let verdict = "VERDE";
  if (failures.length) verdict = "ROJO";
  else if (skips.length || incomplete) verdict = "AMARILLO";

  const payload = {
    change: change.name,
    changeSource: change.source,
    mode: args.mode,
    verdict,
    tasks,
    steps: results,
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`\nGate: ${change.name} (${change.source}) — modo ${args.mode}\n`);
    for (const r of results) {
      const secs = (r.durationMs / 1000).toFixed(1) + "s";
      console.log(`  ${r.status.padEnd(4)}  ${r.label.padEnd(22)} ${secs.padStart(7)}`);
      if (r.detail && r.status !== "OK") {
        for (const line of r.detail.split(/\r?\n/).slice(0, 12)) console.log(`        ${line}`);
      }
    }
    console.log("");
    if (tasks) console.log(`  Tasks: ${tasks.done}/${tasks.total} completas${tasks.pending ? ` (${tasks.pending} pendientes)` : ""}`);
    console.log(`\n  VEREDICTO: ${verdict}  (${results.length} pasos, ${failures.length} fallos, ${skips.length} skips)\n`);
  }

  return verdict === "ROJO" ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err?.stack ?? String(err));
    process.exit(2);
  });
