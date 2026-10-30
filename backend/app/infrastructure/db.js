import pg from 'pg';

const { Pool } = pg;

export function getDbConfig(overrides = {}) {
  const connectionString =
    overrides.connectionString ||
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/odonto';

  return {
    connectionString,
    max: overrides.max || 10,
    idleTimeoutMillis: overrides.idleTimeoutMillis || 30000,
    ...overrides,
  };
}

let defaultPool = null;

export function createPool(options = {}) {
  const config = getDbConfig(options);
  return new Pool(config);
}

export function getPool() {
  if (!defaultPool) {
    defaultPool = createPool();
  }
  return defaultPool;
}

export async function closePool(pool = defaultPool) {
  if (pool) {
    await pool.end();
    if (pool === defaultPool) {
      defaultPool = null;
    }
  }
}

export async function query(text, params, pool = getPool()) {
  return pool.query(text, params);
}
