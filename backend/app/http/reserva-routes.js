import { Router } from 'express';
import { z } from 'zod';
import { buildDisponibilidad, crearTurno, ReservaError } from '../application/reserva-service.js';
import {
  TenantRepository,
  OdontologoRepository,
  PacienteRepository,
  TurnoRepository,
} from '../infrastructure/repositories/index.js';
import { tenantMiddleware, resolverTenantId } from '../infrastructure/tenant.js';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

const DisponibilidadQuerySchema = z.object({
  odontologoId: z.string().uuid('odontologoId debe ser un UUID válido'),
  fecha: z.string().trim().regex(FECHA_REGEX, 'fecha debe tener formato YYYY-MM-DD'),
});

const TurnoBodySchema = z.object({
  odontologoId: z.string().uuid('odontologoId debe ser un UUID válido'),
  inicio: z.string().trim().min(1, 'inicio es obligatorio'),
  fin: z.string().trim().min(1, 'fin es obligatorio'),
  // nombre y teléfono se validan en el servicio para devolver 422 RN-TU-03
  // (regla de negocio) en vez de 400 (input mal formado).
  paciente: z
    .object({
      nombre: z.string().optional(),
      telefono: z.string().optional(),
    })
    .optional(),
});

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Acepta ISO 8601 con offset (`-03:00` o `Z`). Si viene sin offset se asume
 * hora de Buenos Aires, que es la zona del consultorio.
 */
function parseFechaHora(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!FECHA_HORA_REGEX.test(trimmed)) return null;
  const conOffset = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed) ? trimmed : `${trimmed}-03:00`;
  const date = new Date(conOffset);
  return Number.isNaN(date.getTime()) ? null : date;
}

function responderError(res, error, next) {
  if (error instanceof ReservaError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  return next(error);
}

export function createReservaRouter({
  tenantRepository = new TenantRepository(),
  odontologoRepository = new OdontologoRepository(),
  pacienteRepository = new PacienteRepository(),
  turnoRepository = new TurnoRepository(),
  now = () => new Date(),
} = {}) {
  const router = Router();

  router.use(tenantMiddleware());

  router.get(
    '/disponibilidad',
    asyncHandler(async (req, res, next) => {
      const parsed = DisponibilidadQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          code: 'RESERVA_INVALID_INPUT',
          error: 'odontologoId y fecha son obligatorios con formato válido',
        });
      }

      try {
        const tenant_id = await resolverTenantId(req, tenantRepository);
        if (!tenant_id) {
          return res.status(404).json({
            code: 'RESERVA_TENANT_NO_ENCONTRADO',
            error: 'Consultorio no encontrado',
          });
        }

        const resultado = await buildDisponibilidad({
          tenant_id,
          odontologo_id: parsed.data.odontologoId,
          fecha: parsed.data.fecha,
          ahora: now(),
          odontologoRepository,
          turnoRepository,
        });
        return res.status(200).json(resultado);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  router.post(
    '/turnos',
    asyncHandler(async (req, res, next) => {
      const parsed = TurnoBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          code: 'RESERVA_INVALID_INPUT',
          error: 'odontologoId, inicio y fin son obligatorios con formato válido',
        });
      }

      const inicio = parseFechaHora(parsed.data.inicio);
      const fin = parseFechaHora(parsed.data.fin);
      if (!inicio || !fin) {
        return res.status(400).json({
          code: 'RESERVA_INVALID_INPUT',
          error: 'inicio y fin deben ser fechas ISO 8601 válidas',
        });
      }

      try {
        const tenant_id = await resolverTenantId(req, tenantRepository);
        if (!tenant_id) {
          return res.status(404).json({
            code: 'RESERVA_TENANT_NO_ENCONTRADO',
            error: 'Consultorio no encontrado',
          });
        }

        const turno = await crearTurno({
          tenant_id,
          odontologo_id: parsed.data.odontologoId,
          inicio,
          fin,
          paciente: parsed.data.paciente,
          ahora: now(),
          odontologoRepository,
          pacienteRepository,
          turnoRepository,
        });
        return res.status(201).json(turno);
      } catch (error) {
        return responderError(res, error, next);
      }
    })
  );

  return router;
}
