import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTenantIdentifier,
  tenantMiddleware,
} from '../app/infrastructure/tenant.js';

describe('Tenant Resolution Helper and Middleware (RN-MT-01)', () => {
  test('extrae tenant_id o slug desde header x-tenant-slug', () => {
    const req = {
      headers: { 'x-tenant-slug': 'clinica-norte' },
    };
    const tenant = resolveTenantIdentifier(req);
    assert.equal(tenant.slug, 'clinica-norte');
  });

  test('extrae tenant_id desde header x-tenant-id', () => {
    const req = {
      headers: { 'x-tenant-id': '11111111-2222-3333-4444-555555555555' },
    };
    const tenant = resolveTenantIdentifier(req);
    assert.equal(tenant.id, '11111111-2222-3333-4444-555555555555');
  });

  test('usa fallback a TENANT_DEFAULT si no hay headers', () => {
    process.env.TENANT_DEFAULT = 'demo-consultorio';
    const req = { headers: {} };
    const tenant = resolveTenantIdentifier(req);
    assert.equal(tenant.slug, 'demo-consultorio');
  });

  test('tenantMiddleware adjunta el identificador de tenant al req y llama next', () => {
    const req = {
      headers: { 'x-tenant-slug': 'consultorio-central' },
    };
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    const mw = tenantMiddleware();
    mw(req, res, next);

    assert.ok(nextCalled);
    assert.ok(req.tenant);
    assert.equal(req.tenant.slug, 'consultorio-central');
  });
});
