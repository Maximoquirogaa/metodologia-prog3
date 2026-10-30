import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPool, closePool } from '../app/infrastructure/db.js';

export async function runMigrations(pool = getPool(), migrationsDir) {
  const dir = migrationsDir || (
    existsSync(join(process.cwd(), 'migrations'))
      ? join(process.cwd(), 'migrations')
      : join(process.cwd(), 'backend', 'migrations')
  );

  const client = await pool.connect();
  const appliedMigrations = [];

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: existingRows } = await client.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(existingRows.map(r => r.name));

    const files = readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!appliedSet.has(file)) {
        const fullPath = join(dir, file);
        const sql = readFileSync(fullPath, 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        appliedMigrations.push(file);
      }
    }

    await client.query('COMMIT');
    return appliedMigrations;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename || '');
if (isMain) {
  runMigrations()
    .then(applied => {
      console.log(`Migraciones completadas: ${applied.length} aplicada(s) — [${applied.join(', ')}]`);
      return closePool();
    })
    .catch(err => {
      console.error('Error ejecutando migraciones:', err);
      process.exit(1);
    });
}
