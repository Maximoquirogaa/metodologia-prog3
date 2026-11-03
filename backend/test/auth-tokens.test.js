import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getJwtSecret,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../app/infrastructure/auth/tokens.js';

const user = {
  id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  rol: 'secretaria',
  email: 'secretaria@demo.test',
};

const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe('JWT token service', () => {
  test('el access token incluye todos los claims requeridos y expira en 15 min', () => {
    const token = signAccessToken(user);
    const payload = jwt.verify(token, getJwtSecret());

    assert.equal(payload.sub, user.id);
    assert.equal(payload.tenant_id, user.tenant_id);
    assert.equal(payload.rol, 'secretaria');
    assert.equal(payload.email, user.email);
    assert.equal(payload.type, 'access');
    assert.equal(typeof payload.jti, 'string');
    assert.ok(payload.jti.length > 0);
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp - payload.iat, ACCESS_TOKEN_TTL_SECONDS);
    assert.equal(ACCESS_TOKEN_TTL_SECONDS, 15 * 60);
  });

  test('el refresh token tiene type=refresh y expira en 7 días', () => {
    const token = signRefreshToken(user);
    const payload = jwt.verify(token, getJwtSecret());

    assert.equal(payload.type, 'refresh');
    assert.equal(payload.sub, user.id);
    assert.equal(payload.tenant_id, user.tenant_id);
    assert.equal(payload.exp - payload.iat, REFRESH_TOKEN_TTL_SECONDS);
    assert.equal(REFRESH_TOKEN_TTL_SECONDS, 7 * 24 * 60 * 60);
  });

  test('cada token emite un jti distinto', () => {
    const a = jwt.verify(signAccessToken(user), getJwtSecret());
    const b = jwt.verify(signAccessToken(user), getJwtSecret());
    assert.notEqual(a.jti, b.jti);
  });

  test('verifyAccessToken rechaza un refresh token (type mismatch)', () => {
    const refresh = signRefreshToken(user);
    assert.throws(() => verifyAccessToken(refresh));
  });

  test('verifyRefreshToken rechaza un access token (type mismatch)', () => {
    const access = signAccessToken(user);
    assert.throws(() => verifyRefreshToken(access));
  });

  test('un access token expirado es rechazado', () => {
    const token = signAccessToken(user);
    const { exp } = jwt.verify(token, getJwtSecret());
    // Simula que el reloj está 1 segundo después del vencimiento.
    assert.throws(() => verifyAccessToken(token, { clockTimestamp: exp + 1 }));
  });

  test('un token firmado con otro secreto es rechazado', () => {
    const forged = jwt.sign(
      { tenant_id: user.tenant_id, rol: 'secretaria', email: user.email, type: 'access', jti: 'x' },
      'otro-secreto',
      { subject: user.id, expiresIn: '15m' }
    );
    assert.throws(() => verifyAccessToken(forged));
  });
});
