import { randomBytes } from 'node:crypto';
import {
  generarSlots,
  estaDentroDeHorario,
  slotEnPasado,
  parseFecha,
  formatIsoBuenosAires,
} from '../domain/horario.js';

/**
 * Error de negocio de la reserva. `status` es el HTTP a devolver y `code` el
 * código RN de la convención del proyecto (RN-TU-01/03/04) o de validación.
 */
export class ReservaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ReservaError';
    this.status = status;
    this.code = code;
  }
}

export function generarTokenCancelacion() {
  return randomBytes(24).toString('base64url');
}

function solapan(intervalo, turno) {
  return intervalo.inicio < turno.fin && intervalo.fin > turno.inicio;
}

/**
 * true solo para el error de exclusión de la constraint anti-overlap.
 * Se verifica el nombre de la constraint para no convertir otros `23P01`
 * en un falso RN-TU-01.
 */
export function esConflictoDeSolapamiento(error) {
  return (
    error != null &&
    error.code === '23P01' &&
    error.constraint === 'turnos_no_overlap'
  );
}

async function resolverOdontologo({ tenant_id, odontologo_id, odontologoRepository }) {
  const odontologo = await odontologoRepository.findById(tenant_id, odontologo_id);
  if (!odontologo) {
    throw new ReservaError(404, 'RESERVA_ODONTOLOGO_NO_ENCONTRADO', 'Odontólogo no encontrado');
  }
  return odontologo;
}

function validarIntervalo(inicio, fin, ahora) {
  if (!(inicio instanceof Date) || !(fin instanceof Date)) {
    throw new ReservaError(400, 'RESERVA_INVALID_INPUT', 'inicio y fin deben ser fechas válidas');
  }
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new ReservaError(400, 'RESERVA_INVALID_INPUT', 'inicio y fin deben ser fechas válidas');
  }
  if (fin.getTime() <= inicio.getTime()) {
    throw new ReservaError(400, 'RESERVA_INVALID_INPUT', 'fin debe ser posterior a inicio');
  }
  if (slotEnPasado(inicio, ahora)) {
    throw new ReservaError(400, 'RESERVA_INVALID_INPUT', 'no se puede reservar un turno que ya comenzó');
  }
}

/**
 * Slots libres de un odontólogo para un día: grilla de horario menos turnos
 * activos y menos slots que ya comenzaron.
 */
export async function buildDisponibilidad({
  tenant_id,
  odontologo_id,
  fecha,
  ahora = new Date(),
  odontologoRepository,
  turnoRepository,
}) {
  const partes = parseFecha(fecha);
  if (!partes) {
    throw new ReservaError(400, 'RESERVA_INVALID_FECHA', 'fecha debe tener formato YYYY-MM-DD');
  }

  await resolverOdontologo({ tenant_id, odontologo_id, odontologoRepository });

  const grilla = generarSlots(fecha);
  if (grilla.length === 0) {
    return { fecha, odontologoId: odontologo_id, slots: [] };
  }

  const desde = grilla[0].inicio;
  const hasta = grilla[grilla.length - 1].fin;
  const ocupados = await turnoRepository.findActivosByOdontologoAndDay(
    tenant_id,
    odontologo_id,
    desde,
    hasta
  );

  const libres = grilla.filter(
    (slot) => !slotEnPasado(slot.inicio, ahora) && !ocupados.some((turno) => solapan(slot, turno))
  );

  return {
    fecha,
    odontologoId: odontologo_id,
    slots: libres.map((slot) => ({
      inicio: formatIsoBuenosAires(slot.inicio),
      fin: formatIsoBuenosAires(slot.fin),
    })),
  };
}

async function resolverPaciente({ tenant_id, paciente, pacienteRepository }) {
  const nombre = typeof paciente?.nombre === 'string' ? paciente.nombre.trim() : '';
  const telefono = typeof paciente?.telefono === 'string' ? paciente.telefono.trim() : '';

  if (!nombre || !telefono) {
    throw new ReservaError(
      422,
      'RN-TU-03',
      'El turno requiere paciente con nombre y teléfono'
    );
  }

  const existente = await pacienteRepository.findByTelefono(tenant_id, telefono);
  if (existente) return existente;

  return pacienteRepository.create({ tenant_id, nombre, telefono });
}

/**
 * Crea un turno reservado con paciente find-or-create y token de cancelación.
 * Devuelve las fechas ya serializadas en hora de Buenos Aires.
 */
export async function crearTurno({
  tenant_id,
  odontologo_id,
  inicio,
  fin,
  paciente,
  ahora = new Date(),
  odontologoRepository,
  pacienteRepository,
  turnoRepository,
  generarToken = generarTokenCancelacion,
}) {
  validarIntervalo(inicio, fin, ahora);
  await resolverOdontologo({ tenant_id, odontologo_id, odontologoRepository });

  if (!estaDentroDeHorario(inicio, fin)) {
    throw new ReservaError(
      422,
      'RN-TU-04',
      'El turno debe estar dentro del horario de atención (Lun–Vie 09:00–18:00)'
    );
  }

  const pacienteFinal = await resolverPaciente({ tenant_id, paciente, pacienteRepository });

  const solapados = await turnoRepository.findActivosByOdontologoAndDay(
    tenant_id,
    odontologo_id,
    inicio,
    fin
  );
  if (solapados.length > 0) {
    throw new ReservaError(422, 'RN-TU-01', 'El odontólogo ya tiene un turno en ese horario');
  }

  try {
    const turno = await turnoRepository.create({
      tenant_id,
      odontologo_id,
      paciente_id: pacienteFinal.id,
      inicio,
      fin,
      estado: 'reservado',
      token_cancelacion: generarToken(),
    });

    return {
      id: turno.id,
      tenant_id: turno.tenant_id,
      odontologo_id: turno.odontologo_id,
      paciente_id: turno.paciente_id,
      inicio: formatIsoBuenosAires(turno.inicio),
      fin: formatIsoBuenosAires(turno.fin),
      estado: turno.estado,
      token_cancelacion: turno.token_cancelacion,
    };
  } catch (error) {
    if (esConflictoDeSolapamiento(error)) {
      throw new ReservaError(422, 'RN-TU-01', 'El odontólogo ya tiene un turno en ese horario');
    }
    throw error;
  }
}
