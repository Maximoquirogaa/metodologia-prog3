/**
 * Blacklist de JTIs revocados.
 *
 * Es intencionalmente en memoria (ver design.md): se pierde al reiniciar el
 * proceso y no se comparte entre instancias. Aceptable para el MVP.
 */
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

const revoked = new Map(); // jti -> expiración en milisegundos

export function revokeJti(jti, expiresAtSeconds) {
  if (!jti) return;
  const expiresAtMs = Number.isFinite(expiresAtSeconds)
    ? expiresAtSeconds * 1000
    : Date.now() + DEFAULT_TTL_SECONDS * 1000;
  revoked.set(jti, expiresAtMs);
}

export function isJtiRevoked(jti) {
  if (!jti) return false;
  const expiresAtMs = revoked.get(jti);
  if (expiresAtMs === undefined) return false;
  if (expiresAtMs <= Date.now()) {
    revoked.delete(jti);
    return false;
  }
  return true;
}

export function clearRevokedJtis() {
  revoked.clear();
}

export function revokedJtiCount() {
  return revoked.size;
}
