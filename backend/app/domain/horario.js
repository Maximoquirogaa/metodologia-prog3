/**
 * Horario de atención y grilla de slots.
 *
 * Regla dura del proyecto: la reserva no puede salir del horario del
 * odontólogo (RN-TU-04). En v1 el horario es una constante compartida
 * (Lun–Vie 09:00–18:00) — no hay tabla de horarios en el modelo.
 *
 * Zona horaria: America/Argentina/Buenos_Aires se modela como offset fijo
 * -03:00 porque Argentina no aplica horario de verano desde 2009. Eso evita
 * dependencias de TZ y hace los tests determinísticos.
 */

export const HORARIO_ATENCION = Object.freeze({
  dias: Object.freeze([1, 2, 3, 4, 5]), // 1 = lunes ... 5 = viernes
  apertura: '09:00',
  cierre: '18:00',
  duracionSlotMin: 30,
  offsetMinutos: -180, // -03:00
});

const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_MINUTO = 60 * 1000;

function minutosDesdeHora(hora) {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * Valida y descompone una fecha `YYYY-MM-DD`. Devuelve null si el formato es
 * inválido o la fecha no existe (por ejemplo 2026-02-30).
 */
export function parseFecha(fecha) {
  if (typeof fecha !== 'string') return null;
  const match = FECHA_REGEX.exec(fecha.trim());
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/**
 * Devuelve las partes de fecha/hora "de pared" en Buenos Aires para un
 * instante dado. Se obtiene corriendo el reloj al offset local.
 */
function partesBuenosAires(date) {
  const shifted = new Date(date.getTime() + HORARIO_ATENCION.offsetMinutos * MS_POR_MINUTO);
  return {
    anio: shifted.getUTCFullYear(),
    mes: shifted.getUTCMonth() + 1,
    dia: shifted.getUTCDate(),
    diaSemana: shifted.getUTCDay(),
    minutos: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * Instante UTC que corresponde a una hora de pared de Buenos Aires.
 */
function instanteBuenosAires(anio, mes, dia, minutosDelDia) {
  return new Date(
    Date.UTC(anio, mes - 1, dia) +
      (minutosDelDia - HORARIO_ATENCION.offsetMinutos) * MS_POR_MINUTO
  );
}

/**
 * Grilla de slots de un día. Devuelve [] si la fecha no existe o el día no
 * tiene atención (fin de semana).
 */
export function generarSlots(fecha) {
  const partes = parseFecha(fecha);
  if (!partes) return [];

  const diaSemana = new Date(Date.UTC(partes.y, partes.m - 1, partes.d)).getUTCDay();
  if (!HORARIO_ATENCION.dias.includes(diaSemana)) return [];

  const apertura = minutosDesdeHora(HORARIO_ATENCION.apertura);
  const cierre = minutosDesdeHora(HORARIO_ATENCION.cierre);
  const slots = [];

  for (let minuto = apertura; minuto + HORARIO_ATENCION.duracionSlotMin <= cierre; minuto += HORARIO_ATENCION.duracionSlotMin) {
    slots.push({
      inicio: instanteBuenosAires(partes.y, partes.m, partes.d, minuto),
      fin: instanteBuenosAires(partes.y, partes.m, partes.d, minuto + HORARIO_ATENCION.duracionSlotMin),
    });
  }

  return slots;
}

/**
 * true solo si el intervalo cae completo dentro del horario de atención:
 * mismo día hábil, ambos extremos entre apertura y cierre, con fin > inicio.
 */
export function estaDentroDeHorario(inicio, fin) {
  if (!(inicio instanceof Date) || !(fin instanceof Date)) return false;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return false;
  if (fin.getTime() <= inicio.getTime()) return false;

  const desde = partesBuenosAires(inicio);
  const hasta = partesBuenosAires(fin);

  if (!HORARIO_ATENCION.dias.includes(desde.diaSemana)) return false;
  if (!HORARIO_ATENCION.dias.includes(hasta.diaSemana)) return false;
  if (desde.anio !== hasta.anio || desde.mes !== hasta.mes || desde.dia !== hasta.dia) {
    return false;
  }

  const apertura = minutosDesdeHora(HORARIO_ATENCION.apertura);
  const cierre = minutosDesdeHora(HORARIO_ATENCION.cierre);

  return desde.minutos >= apertura && hasta.minutos <= cierre;
}

/**
 * true si el slot ya comenzó (o comenzará exactamente en `ahora`).
 */
export function slotEnPasado(inicio, ahora = new Date()) {
  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) return true;
  return inicio.getTime() <= ahora.getTime();
}

/**
 * Serializa un instante en ISO 8601 con el offset de Buenos Aires,
 * por ejemplo `2026-11-09T09:00:00-03:00`. No se usa toISOString() porque
 * expondría UTC (`12:00:00Z`) y la reserva se lee en hora local.
 */
export function formatIsoBuenosAires(date) {
  const partes = partesBuenosAires(date);
  const pad = (n) => String(n).padStart(2, '0');
  const hh = Math.floor(partes.minutos / 60);
  const mm = partes.minutos % 60;
  return (
    `${partes.anio}-${pad(partes.mes)}-${pad(partes.dia)}` +
    `T${pad(hh)}:${pad(mm)}:00-03:00`
  );
}
