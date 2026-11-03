import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UserRepository } from '../app/infrastructure/repositories/index.js';

const tenantA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const tenantB = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const userId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

function makeMockDb(responder) {
  const executed = [];
  const db = {
    async query(text, params) {
      executed.push({ text, params });
      return responder(text, params);
    },
  };
  return { db, executed };
}

describe('UserRepository', () => {
  test('create inserta con tenant_id y devuelve columnas explícitas sin password_hash', async () => {
    const { db, executed } = makeMockDb(() => ({
      rows: [
        {
          id: userId,
          tenant_id: tenantA,
          email: 'secretaria@demo.test',
          rol: 'secretaria',
        },
      ],
    }));

    const repo = new UserRepository(db);
    const user = await repo.create({
      tenant_id: tenantA,
      email: 'secretaria@demo.test',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'secretaria',
    });

    assert.equal(user.email, 'secretaria@demo.test');
    assert.equal(user.password_hash, undefined, 'Nunca se devuelve el hash al caller de create');
    const { text, params } = executed[0];
    assert.ok(!text.includes('SELECT *'), 'Prohibido SELECT *');
    assert.match(text, /INSERT\s+INTO\s+users/i);
    assert.match(text, /RETURNING\s+id,\s*tenant_id,\s*email,\s*rol/i);
    assert.ok(!/RETURNING[^;]*password_hash/i.test(text));
    assert.deepEqual(params, [
      tenantA,
      'secretaria@demo.test',
      '$2b$12$abcdefghijklmnopqrstuv',
      'secretaria',
      null,
    ]);
  });

  test('findByEmailAndTenant filtra por tenant_id y email (nunca cross-tenant)', async () => {
    const { db, executed } = makeMockDb(() => ({
      rows: [
        {
          id: userId,
          tenant_id: tenantA,
          email: 'secretaria@demo.test',
          password_hash: '$2b$12$abcdefghijklmnopqrstuv',
          rol: 'secretaria',
        },
      ],
    }));

    const repo = new UserRepository(db);
    const user = await repo.findByEmailAndTenant(tenantA, 'secretaria@demo.test');

    assert.equal(user.id, userId);
    assert.equal(user.password_hash, '$2b$12$abcdefghijklmnopqrstuv');
    const { text, params } = executed[0];
    assert.ok(!text.includes('SELECT *'));
    assert.match(text, /WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+email\s*=\s*\$2/i);
    assert.deepEqual(params, [tenantA, 'secretaria@demo.test']);
  });

  test('findByEmailAndTenant devuelve null si el email pertenece a otro tenant', async () => {
    const { db } = makeMockDb((text, params) => {
      // Simula la DB: solo devuelve el usuario si tenant y email coinciden.
      if (params[0] === tenantA && params[1] === 'secretaria@demo.test') {
        return { rows: [{ id: userId, tenant_id: tenantA, email: params[1] }] };
      }
      return { rows: [] };
    });

    const repo = new UserRepository(db);
    const fromOtherTenant = await repo.findByEmailAndTenant(tenantB, 'secretaria@demo.test');
    assert.equal(fromOtherTenant, null);
  });

  test('findById exige tenant_id + id y no expone password_hash', async () => {
    const { db, executed } = makeMockDb(() => ({
      rows: [{ id: userId, tenant_id: tenantA, email: 'secretaria@demo.test', rol: 'secretaria' }],
    }));

    const repo = new UserRepository(db);
    const user = await repo.findById(tenantA, userId);

    assert.equal(user.id, userId);
    assert.equal(user.password_hash, undefined);
    const { text, params } = executed[0];
    assert.match(text, /WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+id\s*=\s*\$2/i);
    assert.ok(!/SELECT[^;]*password_hash/i.test(text));
    assert.deepEqual(params, [tenantA, userId]);
  });

  test('findById selecciona odontologo_id sin SELECT *', async () => {
    const odontologoId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
    const { db, executed } = makeMockDb(() => ({
      rows: [
        {
          id: userId,
          tenant_id: tenantA,
          email: 'odontologo@demo.test',
          rol: 'odontologo',
          odontologo_id: odontologoId,
        },
      ],
    }));

    const repo = new UserRepository(db);
    const user = await repo.findById(tenantA, userId);

    assert.equal(user.odontologo_id, odontologoId);
    const { text } = executed[0];
    assert.ok(!text.includes('SELECT *'));
    assert.match(text, /odontologo_id/);
  });

  test('findByEmailAndTenant selecciona odontologo_id sin SELECT *', async () => {
    const odontologoId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
    const { db, executed } = makeMockDb(() => ({
      rows: [
        {
          id: userId,
          tenant_id: tenantA,
          email: 'odontologo@demo.test',
          password_hash: '$2b$12$abcdefghijklmnopqrstuv',
          rol: 'odontologo',
          odontologo_id: odontologoId,
        },
      ],
    }));

    const repo = new UserRepository(db);
    const user = await repo.findByEmailAndTenant(tenantA, 'odontologo@demo.test');

    assert.equal(user.odontologo_id, odontologoId);
    const { text, params } = executed[0];
    assert.ok(!text.includes('SELECT *'));
    assert.match(text, /odontologo_id/);
    assert.deepEqual(params, [tenantA, 'odontologo@demo.test']);
  });

  test('create propaga el error de unicidad (tenant_id, email) del motor', async () => {
    const { db } = makeMockDb(() => {
      const err = new Error('duplicate key value violates unique constraint "uq_users_tenant_email"');
      err.code = '23505';
      throw err;
    });

    const repo = new UserRepository(db);
    await assert.rejects(
      () =>
        repo.create({
          tenant_id: tenantA,
          email: 'secretaria@demo.test',
          password_hash: '$2b$12$abcdefghijklmnopqrstuv',
          rol: 'secretaria',
        }),
      err => err.code === '23505'
    );
  });
});
