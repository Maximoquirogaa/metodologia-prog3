import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDbConfig, createPool, closePool, query } from '../app/infrastructure/db.js';

describe('Database Configuration and Client Pool', () => {
  test('getDbConfig retorna configuración por defecto basada en DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/odonto_test';
    const config = getDbConfig();
    assert.equal(config.connectionString, 'postgres://user:pass@localhost:5432/odonto_test');
  });

  test('getDbConfig usa fallback local si DATABASE_URL no está definida', () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const config = getDbConfig();
      assert.ok(config.connectionString.includes('localhost') || config.connectionString.includes('127.0.0.1'));
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  test('createPool crea una instancia del pool y closePool la cierra limpiamente', async () => {
    const pool = createPool({ connectionString: 'postgres://dummy:dummy@localhost:5432/dummy' });
    assert.ok(pool);
    assert.equal(typeof pool.query, 'function');
    await closePool(pool);
  });

  test('query delega la llamada al pool provisto con parámetros', async () => {
    const mockPool = {
      queryCalls: [],
      async query(text, params) {
        this.queryCalls.push({ text, params });
        return { rows: [{ val: 1 }] };
      },
    };
    const res = await query('SELECT 1 as val', [], mockPool);
    assert.deepEqual(res.rows, [{ val: 1 }]);
    assert.equal(mockPool.queryCalls.length, 1);
    assert.equal(mockPool.queryCalls[0].text, 'SELECT 1 as val');
  });
});
