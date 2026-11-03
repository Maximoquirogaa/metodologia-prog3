import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../infrastructure/auth/tokens.js';
import { revokeJti, isJtiRevoked } from '../infrastructure/auth/blacklist.js';
import { createLoginRateLimiter } from '../infrastructure/auth/rate-limiter.js';
import { requireAuth } from '../infrastructure/auth/middleware.js';
import {
  UserRepository,
  TenantRepository,
} from '../infrastructure/repositories/index.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  tenant_id: z.string().uuid().optional(),
  tenant_slug: z.string().trim().min(1).optional(),
});

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function publicUser(user) {
  return {
    id: user.id,
    tenant_id: user.tenant_id,
    rol: user.rol,
    email: user.email,
  };
}

function parseCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

// Hash de relleno para comparar cuando el email no existe y no filtrar
// diferencias de tiempo entre "usuario inexistente" y "password incorrecta".
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(randomUUID(), 10);
  }
  return dummyHashPromise;
}

async function resolveTenantId(req, tenantRepository, body) {
  const explicitId = body.tenant_id || req.headers['x-tenant-id'];
  if (explicitId) return String(explicitId).trim();

  const rawSlug =
    body.tenant_slug ||
    req.headers['x-tenant-slug'] ||
    process.env.TENANT_DEFAULT ||
    'demo';
  const slug = String(rawSlug).trim().toLowerCase();
  const tenant = await tenantRepository.findBySlug(slug);
  return tenant ? tenant.id : null;
}

export function createAuthRouter({
  userRepository = new UserRepository(),
  tenantRepository = new TenantRepository(),
  rateLimiter = createLoginRateLimiter(),
} = {}) {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const parsed = LoginSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          code: 'AUTH_INVALID_INPUT',
          error: 'email y password son obligatorios y válidos',
        });
      }

      const { email, password } = parsed.data;
      const rateKey = `${req.ip}:${email.toLowerCase()}`;
      if (rateLimiter.isBlocked(rateKey)) {
        return res.status(429).json({
          code: 'AUTH_RATE_LIMITED',
          error: 'Demasiados intentos de login. Intentá nuevamente en 60 segundos.',
        });
      }
      rateLimiter.register(rateKey);

      const tenantId = await resolveTenantId(req, tenantRepository, parsed.data);
      const user = tenantId
        ? await userRepository.findByEmailAndTenant(tenantId, email)
        : null;

      const hashToCompare = user ? user.password_hash : await getDummyHash();
      const passwordOk = await bcrypt.compare(password, hashToCompare);

      if (!user || !passwordOk) {
        return res.status(401).json({
          code: 'AUTH_INVALID_CREDENTIALS',
          error: 'Credenciales inválidas',
        });
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

      return res.status(200).json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: publicUser(user),
      });
    })
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const token = parseCookie(req, REFRESH_COOKIE);
      if (!token) {
        return res.status(401).json({
          code: 'AUTH_MISSING_REFRESH',
          error: 'No se presentó refresh token',
        });
      }

      let payload;
      try {
        payload = verifyRefreshToken(token);
      } catch {
        return res.status(401).json({
          code: 'AUTH_INVALID_REFRESH',
          error: 'Refresh token inválido o expirado',
        });
      }

      if (isJtiRevoked(payload.jti)) {
        return res.status(401).json({
          code: 'AUTH_REVOKED_REFRESH',
          error: 'Refresh token revocado',
        });
      }

      const user = await userRepository.findById(payload.tenant_id, payload.sub);
      if (!user) {
        return res.status(401).json({
          code: 'AUTH_INVALID_REFRESH',
          error: 'El usuario del refresh token ya no existe en el tenant',
        });
      }

      // Rotación: el refresh usado se invalida y se emite uno nuevo.
      revokeJti(payload.jti, payload.exp);
      const accessToken = signAccessToken(user);
      const newRefreshToken = signRefreshToken(user);
      res.cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions());

      return res.status(200).json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: publicUser(user),
      });
    })
  );

  router.post(
    '/logout',
    requireAuth(),
    asyncHandler(async (req, res) => {
      revokeJti(req.user.jti, req.user.exp);

      const refreshToken = parseCookie(req, REFRESH_COOKIE);
      if (refreshToken) {
        try {
          const payload = verifyRefreshToken(refreshToken);
          revokeJti(payload.jti, payload.exp);
        } catch {
          // Un refresh inválido no impide cerrar la sesión.
        }
      }

      res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
      });
      return res.status(204).end();
    })
  );

  router.get('/me', requireAuth(), (req, res) => {
    return res.status(200).json({
      id: req.user.id,
      tenant_id: req.user.tenant_id,
      rol: req.user.rol,
      email: req.user.email,
    });
  });

  return router;
}
