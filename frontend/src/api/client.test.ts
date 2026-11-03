import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { login, logout, getAccessToken } from '../auth/store';
import { request, setAuthHandlers } from './client';

describe('cliente HTTP con interceptores de auth', () => {
  beforeEach(() => {
    logout();
    setAuthHandlers({});
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inyecta Authorization Bearer con el token guardado en memoria', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    login('tok-abc', {
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 's@test.com',
    });

    await request('https://api.test/agenda', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers)?.get('Authorization')).toBe(
      'Bearer tok-abc'
    );
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('no envía Authorization cuando no hay token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    await request('https://api.test/agenda');

    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect((init?.headers as Headers)?.get('Authorization')).toBeNull();
  });

  it('al recibir 401 invoca el handler de no autorizado', async () => {
    const on401 = vi.fn();
    const on403 = vi.fn();
    setAuthHandlers({ on401, on403 });

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }));

    login('tok-abc', {
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 's@test.com',
    });

    await request('https://api.test/agenda');

    expect(on401).toHaveBeenCalledTimes(1);
    expect(on403).not.toHaveBeenCalled();
  });

  it('al recibir 403 invoca el handler de acceso denegado', async () => {
    const on401 = vi.fn();
    const on403 = vi.fn();
    setAuthHandlers({ on401, on403 });

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));

    await request('https://api.test/agenda');

    expect(on403).toHaveBeenCalledTimes(1);
    expect(on401).not.toHaveBeenCalled();
  });
});
