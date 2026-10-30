import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../scripts/migrate.js';

describe('Database Migrations Runner', () => {
  test('runMigrations crea schema_migrations y aplica migraciones pendientes', async () => {
    const executedQueries = [];
    const mockClient = {
      async query(text, params) {
        executedQueries.push({ text, params });
        if (text.includes('SELECT name FROM schema_migrations')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release() {},
    };

    const mockPool = {
      async connect() {
        return mockClient;
      },
      async query(text, params) {
        return mockClient.query(text, params);
      },
    };

    const applied = await runMigrations(mockPool);
    assert.ok(Array.isArray(applied));
    assert.ok(applied.includes('001_core_models.sql'));
    assert.ok(executedQueries.some(q => q.text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')));
    assert.ok(executedQueries.some(q => q.text.includes('INSERT INTO schema_migrations')));
  });

  test('runMigrations no re-ejecuta migraciones ya aplicadas (idempotencia)', async () => {
    const executedQueries = [];
    const mockClient = {
      async query(text, params) {
        executedQueries.push({ text, params });
        if (text.includes('SELECT name FROM schema_migrations')) {
          return { rows: [{ name: '001_core_models.sql' }] };
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
    assert.equal(applied.length, 0);
  });

  test('runMigrations hace ROLLBACK ante un error de ejecución SQL', async () => {
    const executedQueries = [];
    const mockClient = {
      async query(text) {
        executedQueries.push(text);
        if (text.includes('CREATE EXTENSION')) {
          throw new Error('Simulated SQL error');
        }
        if (text.includes('SELECT name FROM schema_migrations')) {
          return { rows: [] };
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

    await assert.rejects(
      async () => {
        await runMigrations(mockPool);
      },
      { message: 'Simulated SQL error' }
    );
    assert.ok(executedQueries.includes('ROLLBACK'));
  });
});
