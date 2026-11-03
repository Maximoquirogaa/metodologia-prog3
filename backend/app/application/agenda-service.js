import { parseFecha, rangoDelDia, formatIsoBuenosAires } from '../domain/horario.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Error de negocio de la agenda. `status` es el HTTP a devolver y `code` el
 * código de la convención del proyecto (AGENDA_*).
 */
export class AgendaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AgendaError';
    this.status = status;
    this.code = code;
  }
}

function esUuidValido(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Resuelve el alcance de odontólogo para el rol secretaria.
 * Si se pide odontologoId, valida que exista en el tenant.
 * Devuelve el odontologo_id efectivo (o null para todos).
 */
async function resolverAlcanceSecretaria({
  tenant_id,
  odontologoId,
  odontologoRepository,
}) {
  if (!odontologoId) return null;

  if (!esUuidValido(odontologoId)) {
    throw new AgendaError(400, 'AGENDA_INVALID_INPUT', 'odontologoId debe ser un UUID válido');
  }

  const odontologo = await odontologoRepository.findById(tenant_id, odontologoId);
  if (!odontologo) {
    throw new AgendaError(
      404,
      'AGENDA_ODONTOLOGO_NO_ENCONTRADO',
      'El odontólogo no pertenece a este consultorio'
    );
  }
  return odontologoId;
}

/**
 * Resuelve el alcance de odontólogo para el rol odontólogo.
 * Relee el usuario por tenant_id + id para obtener el vínculo real.
 */
async function resolverAlcanceOdontologo({
  tenant_id,
  userId,
  odontologoId,
  userRepository,
}) {
  const usuario = await userRepository.findById(tenant_id, userId);
  if (!usuario) {
    throw new AgendaError(403, 'AGENDA_SIN_ODONTOLOGO', 'Usuario no encontrado en el consultorio');
  }

  if (!usuario.odontologo_id) {
    throw new AgendaError(
      403,
      'AGENDA_SIN_ODONTOLOGO',
      'El usuario no tiene un odontólogo vinculado'
    );
  }

  if (odontologoId) {
    if (!esUuidValido(odontologoId)) {
      throw new AgendaError(400, 'AGENDA_INVALID_INPUT', 'odontologoId debe ser un UUID válido');
    }
    if (odontologoId !== usuario.odontologo_id) {
      throw new AgendaError(
        403,
        'AGENDA_ODONTOLOGO_AJENO',
        'Un odontólogo solo puede ver su propia agenda'
      );
    }
  }

  return usuario.odontologo_id;
}

/**
 * Construye la agenda diaria de un consultorio.
 *
 * Alcance por rol:
 * - secretaria: todos los turnos del tenant, filtro opcional por odontólogo
 * - odontólogo: solo sus propios turnos (relee el vínculo del usuario)
 *
 * Devuelve { fecha, odontologoId, turnos: [...] } con fechas ISO -03:00.
 * Nunca expone token_cancelacion ni password_hash.
 */
export async function buildAgenda({
  user,
  fecha,
  odontologoId,
  ahora = new Date(),
  userRepository,
  odontologoRepository,
  turnoRepository,
}) {
  if (!fecha || typeof fecha !== 'string') {
    throw new AgendaError(400, 'AGENDA_INVALID_INPUT', 'fecha es obligatoria');
  }

  const partes = parseFecha(fecha);
  if (!partes) {
    throw new AgendaError(400, 'AGENDA_INVALID_INPUT', 'fecha debe tener formato YYYY-MM-DD');
  }

  const { tenant_id, rol, id: userId } = user;

  let alcanceOdontologoId = null;

  if (rol === 'odontologo') {
    alcanceOdontologoId = await resolverAlcanceOdontologo({
      tenant_id,
      userId,
      odontologoId,
      userRepository,
    });
  } else if (rol === 'secretaria') {
    alcanceOdontologoId = await resolverAlcanceSecretaria({
      tenant_id,
      odontologoId,
      odontologoRepository,
    });
  } else {
    throw new AgendaError(403, 'AUTH_FORBIDDEN', 'Rol no autorizado para consultar la agenda');
  }

  const { desde, hasta } = rangoDelDia(fecha);

  const turnosDb = await turnoRepository.findByDay(tenant_id, {
    desde,
    hasta,
    odontologo_id: alcanceOdontologoId,
  });

  const turnos = turnosDb.map((t) => ({
    id: t.id,
    inicio: formatIsoBuenosAires(t.inicio),
    fin: formatIsoBuenosAires(t.fin),
    estado: t.estado,
    paciente: {
      id: t.paciente.id,
      nombre: t.paciente.nombre,
      telefono: t.paciente.telefono,
    },
    odontologo: {
      id: t.odontologo.id,
      nombre: t.odontologo.nombre,
    },
  }));

  return {
    fecha,
    odontologoId: alcanceOdontologoId,
    turnos,
  };
}
