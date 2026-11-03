import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runMigrations } from '../scripts/migrate.js';

describe('Migration 003_users_odontologo.sql DDL verification', () => {
  const migrationPath = existsSync(join(process.cwd(), 'migrations', '003_users_odontologo.sql'))
    ? join(process.cwd(), 'migrations', '003_users_odontologo.sql')
    : join(process.cwd(), 'backend', 'migrations', '003_users_odontologo.sql');

  test('el archivo de migración 003_users_odontologo.sql existe', () => {
    assert.ok(existsSync(migrationPath), `No se encontró ${migrationPath}`);
  });

  test('agrega odontologo_id nullable a users con FK ON DELETE SET NULL', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(sql, /ALTER\s+TABLE\s+users/i);
    assert.match(
      sql,
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+odontologo_id\s+UUID\s+NULL/i
    );
    assert.match(
      sql,
      /REFERENCES\s+odontologos\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i
    );
  });

  test('crea el índice (tenant_id, odontologo_id)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    assert.match(
      sql,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_users_tenant_odontologo\s+ON\s+users\(tenant_id,\s*odontologo_id\)/i
    );
  });

  test('runMigrations aplica 003_users_odontologo.sql después de 002', async () => {
    const executedQueries = [];
    const mockClient = {
      async query(text, params) {
        executedQueries.push({ text, params });
        if (text.includes('SELECT name FROM schema_migrations')) {
          return { rows: [{ name: '001_core_models.sql' }, { name: '002_users.sql' }] };
        }
        return { rows: [] };
      },
      release() {},
    };

    const mockPool = {
      async connect() {
        return mockClient;
      },
    };

    const applied = await runMigrations(mockPool);
    assert.deepEqual(applied, ['003_users_odontologo.sql']);
    assert.ok(
      executedQueries.some(q => q.text.includes('ADD COLUMN IF NOT EXISTS odontologo_id'))
    );
  });
});
