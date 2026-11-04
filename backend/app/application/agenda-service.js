import { z } from 'zod';
import { parseFecha, rangoDelDia, formatIsoBuenosAires } from '../domain/horario.js';

/**
 * Error de negocio de la agenda. `status` es el HTTP a devolver y `code` el
 * código del contrato de errores del proyecto.
 */
export class AgendaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AgendaError';
    this.status = status;
    this.code = code;
  }
}

const UuidSchema = z.string().uuid();

function validarParametros({ fecha, odontologoId }) {
  if (!parseFecha(fecha)) {
    throw new AgendaError(
      400,
      'AGENDA_INVALID_INPUT',
      'fecha es obligatoria y debe tener formato YYYY-MM-DD'
    );
  }

  if (odontologoId !== undefined && odontologoId !== null && odontologoId !== '') {
    if (!UuidSchema.safeParse(odontologoId).success) {
      throw new AgendaError(400, 'AGENDA_INVALID_INPUT', 'odontologoId debe ser un UUID válido');
    }
  }
}

/**
 * Resuelve el odontólogo sobre el que se consulta la agenda según el rol:
 * - odontologo: solo el vinculado a su usuario (403 si no tiene vínculo o pide otro).
 * - secretaria: el solicitado, validado contra el tenant (404 si no existe), o todos.
 */
async function resolverAlcance({ user, odontologoId, userRepository, odontologoRepository }) {
  if (user.rol === 'odontologo') {
    const actual = await userRepository.findById(user.tenant_id, user.id);
    if (!actual || !actual.odontologo_id) {
      throw new AgendaError(
        403,
        'AGENDA_SIN_ODONTOLOGO',
        'El usuario odontólogo no tiene un profesional vinculado'
      );
    }
    if (odontologoId && odontologoId !== actual.odontologo_id) {
      throw new AgendaError(
        403,
        'AGENDA_ODONTOLOGO_AJENO',
        'Un odontólogo solo puede consultar su propia agenda'
      );
    }
    return actual.odontologo_id;
  }

  if (user.rol === 'secretaria') {
    if (!odontologoId) return null;
    const odontologo = await odontologoRepository.findById(user.tenant_id, odontologoId);
    if (!odontologo) {
      throw new AgendaError(
        404,
        'AGENDA_ODONTOLOGO_NO_ENCONTRADO',
        'Odontólogo no encontrado'
      );
    }
    return odontologo.id;
  }

  throw new AgendaError(403, 'AUTH_FORBIDDEN', 'El rol del usuario no puede ver la agenda');
}

function mapearTurno(turno) {
  return {
    id: turno.id,
    inicio: formatIsoBuenosAires(turno.inicio),
    fin: formatIsoBuenosAires(turno.fin),
    estado: turno.estado,
    paciente: {
      id: turno.paciente_id,
      nombre: turno.paciente_nombre,
      telefono: turno.paciente_telefono,
    },
    odontologo: {
      id: turno.odontologo_id,
      nombre: turno.odontologo_nombre,
    },
  };
}

/**
 * Agenda diaria privada del consultorio. El tenant sale siempre del usuario
 * autenticado (`user.tenant_id`), nunca de la petición.
 */
export async function buildAgenda({
  user,
  fecha,
  odontologoId,
  userRepository,
  odontologoRepository,
  turnoRepository,
}) {
  validarParametros({ fecha, odontologoId });

  if (!user || !user.tenant_id) {
    throw new AgendaError(403, 'AUTH_FORBIDDEN', 'Usuario sin consultorio asociado');
  }

  const alcance = await resolverAlcance({
    user,
    odontologoId,
    userRepository,
    odontologoRepository,
  });

  const { desde, hasta } = rangoDelDia(fecha);
  const filas = await turnoRepository.findByDay(user.tenant_id, {
    desde,
    hasta,
    odontologo_id: alcance,
  });

  return {
    fecha,
    odontologoId: alcance,
    turnos: filas.map(mapearTurno),
  };
}
