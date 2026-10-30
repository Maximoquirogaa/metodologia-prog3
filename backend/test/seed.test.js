import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runSeed } from '../scripts/seed.js';

describe('Demo Seed Script (Idempotency & Synthetic Data)', () => {
  test('runSeed crea tenant demo, 1 odontólogo y 3 pacientes sintéticos', async () => {
    const executedQueries = [];
    const mockDb = {
      async query(text, params) {
        executedQueries.push({ text, params });
        if (text.includes('SELECT id, nombre, slug')) {
          // No existe aún el tenant
          return { rows: [] };
        }
        if (text.includes('INSERT INTO tenants')) {
          return {
            rows: [
              {
                id: 't-demo-uuid',
                nombre: 'Consultorio Odontológico Demo',
                slug: 'demo',
              },
            ],
          };
        }
        if (text.includes('INSERT INTO odontologos')) {
          return {
            rows: [
              {
                id: 'o-demo-uuid',
                tenant_id: 't-demo-uuid',
                nombre: 'Dr. Lucas Varela',
                especialidad: 'Odontología General',
                activo: true,
              },
            ],
          };
        }
        if (text.includes('INSERT INTO pacientes')) {
          return {
            rows: [
              {
                id: 'p-demo-uuid',
                tenant_id: 't-demo-uuid',
                nombre: params[1],
                telefono: params[2],
              },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const result = await runSeed(mockDb);

    assert.ok(result);
    assert.equal(result.tenant.slug, 'demo');
    assert.equal(result.odontologo.nombre, 'Dr. Lucas Varela');
    assert.equal(result.pacientes.length, 3);
  });

  test('runSeed es idempotente si el tenant demo ya existe', async () => {
    const mockDb = {
      async query(text, params) {
        if (text.includes('SELECT id, nombre, slug')) {
          // El tenant ya existe
          return {
            rows: [
              {
                id: 't-demo-uuid',
                nombre: 'Consultorio Odontológico Demo',
                slug: 'demo',
              },
            ],
          };
        }
        if (text.includes('SELECT id, tenant_id, nombre, especialidad')) {
          // El odontólogo ya existe
          return {
            rows: [
              {
                id: 'o-demo-uuid',
                tenant_id: 't-demo-uuid',
                nombre: 'Dr. Lucas Varela',
                especialidad: 'Odontología General',
                activo: true,
              },
            ],
          };
        }
        if (text.includes('SELECT id, tenant_id, nombre, telefono')) {
          // Los 3 pacientes ya existen
          return {
            rows: [
              { id: 'p-1', tenant_id: 't-demo-uuid', nombre: 'P1', telefono: '1111' },
              { id: 'p-2', tenant_id: 't-demo-uuid', nombre: 'P2', telefono: '2222' },
              { id: 'p-3', tenant_id: 't-demo-uuid', nombre: 'P3', telefono: '3333' },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const result = await runSeed(mockDb);

    assert.ok(result);
    assert.equal(result.tenant.slug, 'demo');
    assert.equal(result.odontologo.nombre, 'Dr. Lucas Varela');
    assert.equal(result.pacientes.length, 3);
  });
});
