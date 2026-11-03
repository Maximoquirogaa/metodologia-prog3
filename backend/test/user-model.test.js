import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UserSchema,
  UserRolEnum,
  isEmailUniqueInTenant,
} from '../app/domain/models.js';

const tenantA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const tenantB = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('User domain model', () => {
  test('valida un usuario interno completo con tenant_id y rol permitido', () => {
    const res = UserSchema.safeParse({
      tenant_id: tenantA,
      email: 'secretaria@demo.test',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'secretaria',
    });

    assert.ok(res.success);
    assert.equal(res.data.rol, 'secretaria');
    assert.equal(res.data.tenant_id, tenantA);
  });

  test('rechaza un usuario sin tenant_id (aislamiento por tenant)', () => {
    const res = UserSchema.safeParse({
      email: 'secretaria@demo.test',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'secretaria',
    });

    assert.ok(!res.success);
    assert.ok(
      res.error.issues.some(issue => issue.path.includes('tenant_id')),
      'El error debe apuntar a tenant_id'
    );
  });

  test('rechaza un rol fuera de secretaria/odontologo', () => {
    assert.ok(!UserRolEnum.safeParse('admin').success);
    assert.ok(UserRolEnum.safeParse('odontologo').success);
    const res = UserSchema.safeParse({
      tenant_id: tenantA,
      email: 'x@demo.test',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'paciente',
    });
    assert.ok(!res.success);
  });

  test('rechaza un email con formato inválido', () => {
    const res = UserSchema.safeParse({
      tenant_id: tenantA,
      email: 'no-es-un-email',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'secretaria',
    });
    assert.ok(!res.success);
    assert.ok(res.error.issues.some(issue => issue.path.includes('email')));
  });

  test('acepta odontologo_id UUID o null y rechaza uno mal formado', () => {
    const base = {
      tenant_id: tenantA,
      email: 'odontologo@demo.test',
      password_hash: '$2b$12$abcdefghijklmnopqrstuv',
      rol: 'odontologo',
    };

    const conVinculo = UserSchema.safeParse({
      ...base,
      odontologo_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    });
    assert.ok(conVinculo.success);
    assert.equal(conVinculo.data.odontologo_id, 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55');

    const sinVinculo = UserSchema.safeParse({ ...base, odontologo_id: null });
    assert.ok(sinVinculo.success);
    assert.equal(sinVinculo.data.odontologo_id, null);

    const sinCampo = UserSchema.safeParse(base);
    assert.ok(sinCampo.success, 'odontologo_id es opcional');

    const malFormado = UserSchema.safeParse({ ...base, odontologo_id: 'no-es-uuid' });
    assert.ok(!malFormado.success);
  });

  test('el email es único dentro del mismo tenant pero puede repetirse en otro tenant', () => {
    const existing = [
      { tenant_id: tenantA, email: 'secretaria@demo.test' },
    ];

    assert.equal(
      isEmailUniqueInTenant(existing, { tenant_id: tenantA, email: 'secretaria@demo.test' }),
      false,
      'Mismo email en el mismo tenant debe considerarse duplicado'
    );
    assert.equal(
      isEmailUniqueInTenant(existing, { tenant_id: tenantB, email: 'secretaria@demo.test' }),
      true,
      'El mismo email en otro tenant es válido (multi-tenant)'
    );
    assert.equal(
      isEmailUniqueInTenant(existing, { tenant_id: tenantA, email: 'otro@demo.test' }),
      true
    );
  });
});
