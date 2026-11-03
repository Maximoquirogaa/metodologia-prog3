import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Migration 002_users.sql DDL verification', () => {
  const migrationPath = existsSync(join(process.cwd(), 'migrations', '002_users.sql'))
    ? join(process.cwd(), 'migrations', '002_users.sql')
    : join(process.cwd(), 'backend', 'migrations', '002_users.sql');

  test('el archivo de migración 002_users.sql existe', () => {
    assert.ok(existsSync(migrationPath), `No se encontró ${migrationPath}`);
  });

  test('define la tabla users con las columnas requeridas', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+users/i);
    assert.match(sql, /id\s+UUID\s+PRIMARY\s+KEY/i);
    assert.match(sql, /tenant_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+tenants\(id\)/i);
    assert.match(sql, /email\s+VARCHAR\(\d+\)\s+NOT\s+NULL/i);
    assert.match(sql, /password_hash\s+VARCHAR\(\d+\)\s+NOT\s+NULL/i);
    assert.match(sql, /created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
  });

  test('restringe el rol a secretaria u odontologo', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /rol\s+VARCHAR\(\d+\)\s+NOT\s+NULL/i);
    assert.match(sql, /CHECK\s*\(\s*rol\s+IN\s*\(\s*'secretaria'\s*,\s*'odontologo'\s*\)\s*\)/i);
  });

  test('garantiza email único por tenant mediante índice UNIQUE(tenant_id, email)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /UNIQUE\s*\(\s*tenant_id\s*,\s*email\s*\)/i);
  });
});
