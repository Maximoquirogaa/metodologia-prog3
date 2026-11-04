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
        if (text.includes('SELECT id, tenant_id, email, password_hash')) {
          return { rows: [] };
        }
        if (text.includes('INSERT INTO users')) {
          return {
            rows: [
              {
                id: `u-${params[1]}`,
                tenant_id: params[0],
                email: params[1],
                rol: params[3],
                odontologo_id: params[4],
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

  test('runSeed crea los usuarios demo una sola vez y deja el vínculo del odontólogo seteado', async () => {
    const tenant = { id: 't-demo-uuid', nombre: 'Consultorio Odontológico Demo', slug: 'demo' };
    const odontologo = {
      id: 'o-demo-uuid',
      tenant_id: tenant.id,
      nombre: 'Dr. Lucas Varela',
      especialidad: 'Odontología General',
      activo: true,
    };
    const users = [];

    const mockDb = {
      async query(text, params) {
        if (text.includes('SELECT id, nombre, slug')) return { rows: [tenant] };
        if (text.includes('SELECT id, tenant_id, nombre, especialidad')) {
          return { rows: [odontologo] };
        }
        if (text.includes('SELECT id, tenant_id, nombre, telefono')) {
          return {
            rows: [
              { id: 'p-1', tenant_id: tenant.id, nombre: 'Paciente Demo Uno', telefono: '1' },
              { id: 'p-2', tenant_id: tenant.id, nombre: 'Paciente Demo Dos', telefono: '2' },
              { id: 'p-3', tenant_id: tenant.id, nombre: 'Paciente Demo Tres', telefono: '3' },
            ],
          };
        }
        if (text.includes('SELECT id, tenant_id, email, password_hash')) {
          const found = users.find(
            u => u.tenant_id === params[0] && u.email === params[1]
          );
          return { rows: found ? [found] : [] };
        }
        if (text.includes('INSERT INTO users')) {
          const user = {
            id: `u-${users.length + 1}`,
            tenant_id: params[0],
            email: params[1],
            password_hash: params[2],
            rol: params[3],
            odontologo_id: params[4],
          };
          users.push(user);
          return { rows: [user] };
        }
        if (text.includes('UPDATE users')) {
          const found = users.find(
            u => u.tenant_id === params[0] && u.id === params[1]
          );
          if (found) found.odontologo_id = params[2];
          return { rows: found ? [found] : [] };
        }
        return { rows: [] };
      },
    };

    const first = await runSeed(mockDb);
    const second = await runSeed(mockDb);

    assert.equal(first.usuarios.length, 2);
    assert.equal(second.usuarios.length, 2);
    assert.equal(users.length, 2, 'El seed no debe duplicar usuarios entre corridas');

    const secretaria = users.find(u => u.email === 'secretaria@demo.local');
    const odontologoUser = users.find(u => u.email === 'odontologo@demo.local');
    assert.equal(secretaria.rol, 'secretaria');
    assert.equal(secretaria.odontologo_id, null);
    assert.equal(odontologoUser.rol, 'odontologo');
    assert.equal(odontologoUser.odontologo_id, odontologo.id);
    assert.ok(odontologoUser.password_hash.startsWith('$2'), 'El hash debe ser bcrypt');
  });
});
