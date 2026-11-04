import { Router } from 'express';
import { requireAuth, requireRole } from '../infrastructure/auth/middleware.js';
import { buildAgenda, AgendaError } from '../application/agenda-service.js';
import {
  UserRepository,
  OdontologoRepository,
  TurnoRepository,
} from '../infrastructure/repositories/index.js';

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function responderError(res, error, next) {
  if (error instanceof AgendaError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  return next(error);
}

/**
 * Agenda diaria privada. El tenant se toma exclusivamente de `req.user`
 * (claim del access token), nunca de cabeceras de la petición.
 */
export function createAgendaRouter({
  userRepository = new UserRepository(),
  odontologoRepository = new OdontologoRepository(),
  turnoRepository = new TurnoRepository(),
} = {}) {
  const router = Router();

  router.get(
    '/agenda',
    requireAuth(),
    requireRole('secretaria', 'odontologo'),
    asyncHandler(async (req, res, next) => {
      try {
        const agenda = await buildAgenda({
          user: req.user,
          fecha: req.query?.fecha,
          odontologoId: req.query?.odontologoId,
          userRepository,
          odontologoRepository,
          turnoRepository,
        });
        return res.status(200).json(agenda);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  return router;
}
