import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  revokeJti,
  isJtiRevoked,
  clearRevokedJtis,
} from '../app/infrastructure/auth/blacklist.js';
import { createLoginRateLimiter } from '../app/infrastructure/auth/rate-limiter.js';

describe('Token blacklist (in-memory)', () => {
  beforeEach(() => clearRevokedJtis());

  test('un jti revocado deja de ser válido', () => {
    revokeJti('jti-1', Math.floor(Date.now() / 1000) + 60);
    assert.equal(isJtiRevoked('jti-1'), true);
  });

  test('un jti no revocado no está en la blacklist', () => {
    assert.equal(isJtiRevoked('jti-desconocido'), false);
  });

  test('las entradas vencidas se descartan y no bloquean', () => {
    revokeJti('jti-vencido', Math.floor(Date.now() / 1000) - 1);
    assert.equal(isJtiRevoked('jti-vencido'), false);
  });

  test('sin jti no se registra nada (tokens malformados no contaminan la blacklist)', () => {
    revokeJti(undefined, Math.floor(Date.now() / 1000) + 60);
    revokeJti('', Math.floor(Date.now() / 1000) + 60);
    assert.equal(isJtiRevoked(undefined), false);
  });
});

describe('Login rate limiter', () => {
  test('permite 5 intentos y bloquea el 6to dentro de la ventana', () => {
    let clock = 1_000_000;
    const limiter = createLoginRateLimiter({ maxAttempts: 5, windowMs: 60_000, now: () => clock });
    const key = '127.0.0.1:secretaria@demo.test';

    for (let i = 0; i < 5; i += 1) {
      assert.equal(limiter.isBlocked(key), false, `intento ${i + 1} debe permitirse`);
      limiter.register(key);
    }

    assert.equal(limiter.isBlocked(key), true, 'el 6to intento debe estar bloqueado');
  });

  test('libera el bloqueo cuando expira la ventana de 60 s', () => {
    let clock = 1_000_000;
    const limiter = createLoginRateLimiter({ maxAttempts: 5, windowMs: 60_000, now: () => clock });
    const key = '127.0.0.1:secretaria@demo.test';

    for (let i = 0; i < 5; i += 1) limiter.register(key);
    assert.equal(limiter.isBlocked(key), true);

    clock += 60_001;
    assert.equal(limiter.isBlocked(key), false);
  });

  test('la ventana es independiente por IP+email', () => {
    let clock = 1_000_000;
    const limiter = createLoginRateLimiter({ maxAttempts: 5, windowMs: 60_000, now: () => clock });
    const keyA = '127.0.0.1:a@demo.test';
    const keyB = '10.0.0.2:a@demo.test';

    for (let i = 0; i < 5; i += 1) limiter.register(keyA);

    assert.equal(limiter.isBlocked(keyA), true);
    assert.equal(limiter.isBlocked(keyB), false);
  });
});
