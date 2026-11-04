import { Router } from 'express';
import { requireAuth, requireRole } from '../infrastructure/auth/middleware.js';
import { tenantMiddleware, resolverTenantId } from '../infrastructure/tenant.js';
import {
  cancelarTurnoInterno,
  obtenerTurnoPorToken,
  cancelarTurnoPorToken,
  CancelacionError,
} from '../application/cancelacion-service.js';
import {
  TenantRepository,
  UserRepository,
  TurnoRepository,
} from '../infrastructure/repositories/index.js';

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function responderError(res, error, next) {
  if (error instanceof CancelacionError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  return next(error);
}

/**
 * Resuelve el tenant del canal público. Devuelve null si el consultorio de la
 * petición no existe, que se responde igual que un token inexistente.
 */
async function resolverTenantPublico(req, tenantRepository) {
  return resolverTenantId(req, tenantRepository);
}

/**
 * Cancelación de turnos.
 *
 * - `DELETE /turnos/:id`: canal interno, tenant exclusivamente del JWT.
 * - `GET|POST /turnos/cancelar/:token`: link público, tenant de la petición y
 *   token buscado dentro de ese tenant (nunca filtra existencia entre tenants).
 */
export function createCancelacionRouter({
  tenantRepository = new TenantRepository(),
  userRepository = new UserRepository(),
  turnoRepository = new TurnoRepository(),
  ahora = () => new Date(),
  env = process.env,
} = {}) {
  const router = Router();

  router.delete(
    '/turnos/:id',
    requireAuth(),
    requireRole('secretaria', 'odontologo'),
    asyncHandler(async (req, res, next) => {
      try {
        const turno = await cancelarTurnoInterno({
          user: req.user,
          id: req.params.id,
          userRepository,
          turnoRepository,
        });
        return res.status(200).json(turno);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  router.get(
    '/turnos/cancelar/:token',
    tenantMiddleware(),
    asyncHandler(async (req, res, next) => {
      try {
        const tenant_id = await resolverTenantPublico(req, tenantRepository);
        if (!tenant_id) {
          return res.status(404).json({
            code: 'CANCELACION_TURNO_NO_ENCONTRADO',
            error: 'Turno no encontrado',
          });
        }

        const turno = await obtenerTurnoPorToken({
          tenant_id,
          token: req.params.token,
          turnoRepository,
        });
        return res.status(200).json(turno);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  router.post(
    '/turnos/cancelar/:token',
    tenantMiddleware(),
    asyncHandler(async (req, res, next) => {
      try {
        const tenant_id = await resolverTenantPublico(req, tenantRepository);
        if (!tenant_id) {
          return res.status(404).json({
            code: 'CANCELACION_TURNO_NO_ENCONTRADO',
            error: 'Turno no encontrado',
          });
        }

        const turno = await cancelarTurnoPorToken({
          tenant_id,
          token: req.params.token,
          ahora: ahora(),
          env,
          turnoRepository,
        });
        return res.status(200).json(turno);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  return router;
}
