import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const ACCESS_TOKEN_TTL = `${ACCESS_TOKEN_TTL_SECONDS}s`;
const REFRESH_TOKEN_TTL = `${REFRESH_TOKEN_TTL_SECONDS}s`;

/**
 * Secreto de firma. En producción DEBE venir de `JWT_SECRET` (nunca se
 * commitea un secreto real). El fallback solo aplica a desarrollo/tests.
 */
export function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
}

function signToken(user, type, ttl, options = {}) {
  const jti = options.jti || randomUUID();
  return jwt.sign(
    {
      tenant_id: user.tenant_id,
      rol: user.rol,
      email: user.email,
      jti,
      type,
    },
    getJwtSecret(),
    {
      subject: user.id,
      expiresIn: ttl,
    }
  );
}

export function signAccessToken(user, options = {}) {
  return signToken(user, 'access', ACCESS_TOKEN_TTL, options);
}

export function signRefreshToken(user, options = {}) {
  return signToken(user, 'refresh', REFRESH_TOKEN_TTL, options);
}

function verifyToken(token, expectedType, options = {}) {
  const payload = jwt.verify(token, getJwtSecret(), options);
  if (payload.type !== expectedType) {
    throw new Error(`Tipo de token inválido: se esperaba ${expectedType}`);
  }
  return payload;
}

export function verifyAccessToken(token, options = {}) {
  return verifyToken(token, 'access', options);
}

export function verifyRefreshToken(token, options = {}) {
  return verifyToken(token, 'refresh', options);
}
