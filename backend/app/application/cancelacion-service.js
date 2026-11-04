import { z } from 'zod';
import { formatIsoBuenosAires } from '../domain/horario.js';

/**
 * Error de negocio de la cancelación. `status` es el HTTP a devolver y `code`
 * el código de la convención del proyecto (CANCELACION_*, RN-TU-02).
 */
export class CancelacionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'CancelacionError';
    this.status = status;
    this.code = code;
  }
}

const UuidSchema = z.string().uuid();

const MS_POR_HORA = 60 * 60 * 1000;
const ANTELACION_DEFAULT_HORAS = 24;

/**
 * Lee la antelación mínima de la cancelación pública en cada petición, para
 * que un cambio de entorno aplique sin reiniciar. Cualquier valor que no sea
 * un entero >= 0 cae al default de 24 horas.
 *
 * @param {object} [env] - Entorno a leer (inyectable en tests).
 * @returns {number} Horas mínimas de antelación.
 */
export function leerAntelacionMinima(env = process.env) {
  const raw = env?.CANCEL_MIN_HOURS;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) {
    return ANTELACION_DEFAULT_HORAS;
  }
  const horas = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(horas) ? horas : ANTELACION_DEFAULT_HORAS;
}

function esUuidValido(id) {
  return typeof id === 'string' && UuidSchema.safeParse(id).success;
}

function mapearTurno(turno) {
  return {
    id: turno.id,
    inicio: formatIsoBuenosAires(turno.inicio),
    fin: formatIsoBuenosAires(turno.fin),
    estado: turno.estado,
  };
}

function mapearTurnoPublico(turno) {
  return {
    id: turno.id,
    inicio: formatIsoBuenosAires(turno.inicio),
    fin: formatIsoBuenosAires(turno.fin),
    estado: turno.estado,
    paciente: { nombre: turno.paciente_nombre },
    odontologo: { nombre: turno.odontologo_nombre },
  };
}

/**
 * Resuelve el odontologo_id del usuario autenticado. Un odontólogo sin
 * profesional vinculado no puede operar sobre turnos (mismo criterio que la
 * agenda de C-05).
 */
async function resolverOdontologoPropio({ user, userRepository }) {
  const actual = await userRepository.findById(user.tenant_id, user.id);
  if (!actual || !actual.odontologo_id) {
    throw new CancelacionError(
      403,
      'AGENDA_SIN_ODONTOLOGO',
      'El usuario odontólogo no tiene un profesional vinculado'
    );
  }
  return actual.odontologo_id;
}

/**
 * Cancela un turno desde el canal interno. El tenant sale siempre del access
 * token. La secretaria puede cancelar cualquier turno del consultorio; el
 * odontólogo solo los propios. Los internos no tienen antelación mínima.
 *
 * @returns {Promise<{ id: string, inicio: string, fin: string, estado: string }>}
 */
export async function cancelarTurnoInterno({
  user,
  id,
  userRepository,
  turnoRepository,
}) {
  if (!esUuidValido(id)) {
    throw new CancelacionError(
      400,
      'CANCELACION_INVALID_INPUT',
      'El id del turno debe ser un UUID válido'
    );
  }

  if (!user || !user.tenant_id) {
    throw new CancelacionError(403, 'AUTH_FORBIDDEN', 'Usuario sin consultorio asociado');
  }

  const tenant_id = user.tenant_id;
  const turno = await turnoRepository.findById(tenant_id, id);
  if (!turno) {
    throw new CancelacionError(
      404,
      'CANCELACION_TURNO_NO_ENCONTRADO',
      'Turno no encontrado'
    );
  }

  // Idempotente: repetir la cancelación devuelve el estado deseado.
  if (turno.estado === 'cancelado') {
    return mapearTurno(turno);
  }

  if (user.rol === 'odontologo') {
    const propio = await resolverOdontologoPropio({ user, userRepository });
    if (turno.odontologo_id !== propio) {
      throw new CancelacionError(
        403,
        'CANCELACION_ODONTOLOGO_AJENO',
        'Un odontólogo solo puede cancelar sus propios turnos'
      );
    }
  } else if (user.rol !== 'secretaria') {
    throw new CancelacionError(403, 'AUTH_FORBIDDEN', 'El rol no puede cancelar turnos');
  }

  const cancelado = await turnoRepository.cancel(tenant_id, id);
  if (!cancelado) {
    throw new CancelacionError(
      404,
      'CANCELACION_TURNO_NO_ENCONTRADO',
      'Turno no encontrado'
    );
  }

  return mapearTurno(cancelado);
}

/**
 * Datos del turno para el link público de cancelación. El token es el secreto
 * de acceso. No expone teléfono, `token_cancelacion` ni datos de otro tenant.
 */
export async function obtenerTurnoPorToken({ tenant_id, token, turnoRepository }) {
  const turno = await turnoRepository.findByToken(tenant_id, token);
  if (!turno) {
    throw new CancelacionError(
      404,
      'CANCELACION_TURNO_NO_ENCONTRADO',
      'Turno no encontrado'
    );
  }
  return mapearTurnoPublico(turno);
}

/**
 * Cancela por token en el canal público. Exige `CANCEL_MIN_HOURS` horas de
 * antelación (default 24, leído por petición) y es idempotente: un turno ya
 * cancelado responde 200 sin volver a validar la fecha.
 */
export async function cancelarTurnoPorToken({
  tenant_id,
  token,
  ahora = new Date(),
  env = process.env,
  turnoRepository,
}) {
  const turno = await turnoRepository.findByToken(tenant_id, token);
  if (!turno) {
    throw new CancelacionError(
      404,
      'CANCELACION_TURNO_NO_ENCONTRADO',
      'Turno no encontrado'
    );
  }

  if (turno.estado === 'cancelado') {
    return mapearTurno(turno);
  }

  const minHoras = leerAntelacionMinima(env);
  const inicio = new Date(turno.inicio).getTime();
  if (inicio - ahora.getTime() < minHoras * MS_POR_HORA) {
    throw new CancelacionError(
      422,
      'RN-TU-02',
      `No se puede cancelar con menos de ${minHoras} horas de anticipación`
    );
  }

  const cancelado = await turnoRepository.cancelByToken(tenant_id, token);
  if (!cancelado) {
    // Carrera con otra cancelación: se relee para distinguir 404 de idempotencia.
    const actual = await turnoRepository.findByToken(tenant_id, token);
    if (!actual) {
      throw new CancelacionError(
        404,
        'CANCELACION_TURNO_NO_ENCONTRADO',
        'Turno no encontrado'
      );
    }
    return mapearTurno(actual);
  }

  return mapearTurno(cancelado);
}
