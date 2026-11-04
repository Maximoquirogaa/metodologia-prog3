import { getAccessToken } from '../auth/store';

let onUnauthorized: (() => void) | null = null;
let onForbidden: (() => void) | null = null;

/**
 * Configura los handlers globales de 401 (redirect a /login + limpiar token)
 * y 403 (acceso denegado). Se llama desde el router al montar la app.
 */
export function setAuthHandlers({
  on401,
  on403,
}: {
  on401?: () => void;
  on403?: () => void;
}) {
  onUnauthorized = on401 ?? null;
  onForbidden = on403 ?? null;
}

/**
 * Wrapper de fetch que:
 * 1. Inyecta `Authorization: Bearer <accessToken>` desde memoria (regla dura: nunca localStorage).
 * 2. Al recibir 401: invoca onUnauthorized y devuelve la respuesta.
 * 3. Al recibir 403: invoca onForbidden y devuelve la respuesta.
 */
export async function request(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    onUnauthorized?.();
    return res;
  }
  if (res.status === 403) {
    onForbidden?.();
    return res;
  }
  return res;
}
