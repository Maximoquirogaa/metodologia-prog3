/**
 * Decodifica el payload de un JWT (solo lectura, sin verificar firma).
 * Se usa para obtener tenant_id y rol de la sesión. El backend verifica la
 * firma en cada request, por lo que el cliente solo lee los claims.
 * Normaliza `sub` (estándar JWT) a `id` para el consumo del frontend.
 */
export interface JwtPayload {
  id: string;
  tenant_id: string;
  rol: string;
  email: string;
  [key: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payloadBase64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const parsed = JSON.parse(atob(payloadBase64)) as {
      sub?: string;
      id?: string;
      tenant_id?: unknown;
      rol?: unknown;
      email?: unknown;
    };

    if (
      typeof parsed.tenant_id !== 'string' ||
      typeof parsed.rol !== 'string'
    ) {
      return null;
    }

    return {
      id: parsed.sub ?? parsed.id ?? '',
      tenant_id: parsed.tenant_id,
      rol: parsed.rol,
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return null;
  }
}
