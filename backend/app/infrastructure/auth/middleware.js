import { verifyAccessToken } from './tokens.js';
import { isJtiRevoked } from './blacklist.js';

function unauthorized(res, code = 'AUTH_UNAUTHORIZED') {
  return res.status(401).json({ code, error: 'Autenticación requerida o token inválido' });
}

/**
 * Exige un access token JWT válido (firma, expiración, tipo y blacklist).
 * Adjunta `req.user` = { id, tenant_id, rol, email, jti, exp }.
 */
export function requireAuth() {
  return function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) return unauthorized(res, 'AUTH_MISSING_TOKEN');

    try {
      const payload = verifyAccessToken(match[1].trim());
      if (isJtiRevoked(payload.jti)) return unauthorized(res, 'AUTH_REVOKED_TOKEN');
      req.user = {
        id: payload.sub,
        tenant_id: payload.tenant_id,
        rol: payload.rol,
        email: payload.email,
        jti: payload.jti,
        exp: payload.exp,
      };
      return next();
    } catch {
      return unauthorized(res, 'AUTH_INVALID_TOKEN');
    }
  };
}

/**
 * Exige que `req.user.rol` esté entre los roles permitidos. Debe encadenarse
 * después de `requireAuth()`.
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return function roleMiddleware(req, res, next) {
    if (!req.user) return unauthorized(res);
    if (!allowed.includes(req.user.rol)) {
      return res.status(403).json({
        code: 'AUTH_FORBIDDEN',
        error: 'El rol del usuario no tiene permiso para esta acción',
      });
    }
    return next();
  };
}
