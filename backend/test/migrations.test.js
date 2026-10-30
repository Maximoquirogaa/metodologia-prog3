import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Migration 001_core_models.sql DDL verification', () => {
  const migrationPath = existsSync(join(process.cwd(), 'migrations', '001_core_models.sql'))
    ? join(process.cwd(), 'migrations', '001_core_models.sql')
    : join(process.cwd(), 'backend', 'migrations', '001_core_models.sql');

  test('el archivo de migración 001_core_models.sql existe', () => {
    assert.ok(existsSync(migrationPath), `No se encontró ${migrationPath}`);
  });

  test('contiene extensión btree_gist y definición de tablas requeridas', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["']?btree_gist["']?/i);
    assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tenants/i);
    assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+odontologos/i);
    assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+pacientes/i);
    assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+turnos/i);
  });

  test('contiene la constraint de exclusión anti-overlap para turnos activos', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /turnos_no_overlap\s+EXCLUDE\s+USING\s+gist/i);
    assert.match(sql, /odontologo_id\s+WITH\s+=/i);
    assert.match(sql, /tstzrange\(inicio,\s*fin\)\s+WITH\s+&&/i);
    assert.match(sql, /WHERE\s*\(estado\s*!=\s*'cancelado'\)/i);
  });

  test('contiene índices requeridos y columnas de tenant_id en todas las tablas de dominio', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /tenant_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+tenants/i);
    assert.match(sql, /idx_turnos_tenant_odontologo_inicio/i);
  });
});
