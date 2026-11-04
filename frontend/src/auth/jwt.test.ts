import { describe, it, expect } from 'vitest';
import { decodeJwt } from './jwt';

function makeToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.firma-falsa`;
}

describe('decodeJwt (lectura de claims, sin verificar firma)', () => {
  it('extrae tenant_id, rol, id y email de un token de prueba', () => {
    const token = makeToken({
      sub: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
    const decoded = decodeJwt(token);
    expect(decoded).toEqual({
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
  });

  it('retorna null para un token inválido o vacío', () => {
    expect(decodeJwt('no-es-un-jwt')).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('solo.una.part')).toBeNull();
  });
});
