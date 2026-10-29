#!/usr/bin/env node
/**
 * Chequeo de sintaxis de todos los .js del backend.
 *
 * Reemplaza a `node --check src/index.js`, que solo miraba un archivo y daba
 * un verde falso en cuanto el proyecto crecía.
 */
import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOTS = ['src', 'test'];

function collect(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, acc);
    else if (full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const files = [];
for (const root of ROOTS) {
  try {
    collect(root, files);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

if (files.length === 0) {
  console.error('lint: no encontré archivos .js en src/ ni test/');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed = true;
    console.error(`lint: ${file} no compila`);
    console.error(String(err.stderr ?? err.message).trim());
  }
}

if (failed) process.exit(1);
console.log(`lint ok: ${files.length} archivo(s) — ${files.join(', ')}`);
