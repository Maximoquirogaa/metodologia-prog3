import { Router } from 'express';
import { z } from 'zod';
import { buildAgenda, AgendaError } from '../application/agenda-service.js';
import {
  UserRepository,
  OdontologoRepository,
  TurnoRepository,
} from '../infrastructure/repositories/index.js';
import { requireAuth, requireRole } from '../infrastructure/auth/middleware.js';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const AgendaQuerySchema = z.object({
  fecha: z.string().trim().regex(FECHA_REGEX, 'fecha debe tener formato YYYY-MM-DD'),
  odontologoId: z.string().uuid('odontologoId debe ser un UUID válido').optional(),
});

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

export function createAgendaRouter({
  userRepository = new UserRepository(),
  odontologoRepository = new OdontologoRepository(),
  turnoRepository = new TurnoRepository(),
  ahora = () => new Date(),
} = {}) {
  const router = Router();

  router.get(
    '/agenda',
    requireAuth(),
    requireRole('secretaria', 'odontologo'),
    asyncHandler(async (req, res, next) => {
      const parsed = AgendaQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          code: 'AGENDA_INVALID_INPUT',
          error: 'fecha es obligatoria con formato YYYY-MM-DD; odontologoId debe ser UUID válido',
        });
      }

      try {
        const resultado = await buildAgenda({
          user: req.user,
          fecha: parsed.data.fecha,
          odontologoId: parsed.data.odontologoId ?? null,
          ahora: ahora(),
          userRepository,
          odontologoRepository,
          turnoRepository,
        });
        return res.status(200).json(resultado);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  return router;
}
