import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  login,
  logout,
  getAccessToken,
  isAuthenticated,
  getUser,
} from './store';

describe('auth store (memoria, nunca localStorage)', () => {
  beforeEach(() => {
    logout();
    vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem');
  });

  it('guarda el access token en memoria sin escribir en localStorage', () => {
    login('tok-123', {
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });

    expect(getAccessToken()).toBe('tok-123');
    expect(isAuthenticated()).toBe(true);
    expect(getUser()?.rol).toBe('secretaria');
    expect(Storage.prototype.setItem).not.toHaveBeenCalled();
  });

  it('logout limpia el token y el usuario de la memoria', () => {
    login('tok-123', {
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
    logout();

    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
    expect(getUser()).toBeNull();
  });

  it('estado inicial sin token no está autenticado', () => {
    expect(isAuthenticated()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});
