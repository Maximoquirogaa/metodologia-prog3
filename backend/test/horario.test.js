import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORARIO_ATENCION,
  parseFecha,
  generarSlots,
  estaDentroDeHorario,
  slotEnPasado,
  formatIsoBuenosAires,
  rangoDelDia,
} from '../app/domain/horario.js';

const ar = (iso) => new Date(`${iso}-03:00`);

describe('Horario de atención y grilla de slots (RN-TU-04)', () => {
  test('HORARIO_ATENCION define Lun–Vie 09–18 con slots de 30 minutos', () => {
    assert.deepEqual(HORARIO_ATENCION.dias, [1, 2, 3, 4, 5]);
    assert.equal(HORARIO_ATENCION.apertura, '09:00');
    assert.equal(HORARIO_ATENCION.cierre, '18:00');
    assert.equal(HORARIO_ATENCION.duracionSlotMin, 30);
    assert.equal(HORARIO_ATENCION.offsetMinutos, -180);
  });

  test('parseFecha acepta YYYY-MM-DD válidas y rechaza fechas imposibles', () => {
    assert.deepEqual(parseFecha('2026-11-09'), { y: 2026, m: 11, d: 9 });
    assert.equal(parseFecha('09/11/2026'), null);
    assert.equal(parseFecha('2026-13-01'), null);
    assert.equal(parseFecha('2026-02-30'), null);
    assert.equal(parseFecha(undefined), null);
  });

  test('generarSlots de un día hábil devuelve 18 slots de 09:00 a 17:30', () => {
    const slots = generarSlots('2026-11-09');

    assert.equal(slots.length, 18);
    assert.equal(formatIsoBuenosAires(slots[0].inicio), '2026-11-09T09:00:00-03:00');
    assert.equal(formatIsoBuenosAires(slots[0].fin), '2026-11-09T09:30:00-03:00');
    assert.equal(formatIsoBuenosAires(slots[17].inicio), '2026-11-09T17:30:00-03:00');
    assert.equal(formatIsoBuenosAires(slots[17].fin), '2026-11-09T18:00:00-03:00');
  });

  test('generarSlots de sábado o domingo devuelve lista vacía', () => {
    assert.deepEqual(generarSlots('2026-11-07'), []);
    assert.deepEqual(generarSlots('2026-11-08'), []);
  });

  test('generarSlots devuelve lista vacía con fecha inválida', () => {
    assert.deepEqual(generarSlots('2026-02-30'), []);
    assert.deepEqual(generarSlots('no-es-fecha'), []);
  });

  test('estaDentroDeHorario rechaza un inicio antes de la apertura', () => {
    assert.equal(estaDentroDeHorario(ar('2026-11-09T08:59:00'), ar('2026-11-09T09:29:00')), false);
  });

  test('estaDentroDeHorario acepta el último slot 17:30–18:00', () => {
    assert.equal(estaDentroDeHorario(ar('2026-11-09T17:30:00'), ar('2026-11-09T18:00:00')), true);
  });

  test('estaDentroDeHorario rechaza un turno que se pasa del cierre', () => {
    assert.equal(estaDentroDeHorario(ar('2026-11-09T17:45:00'), ar('2026-11-09T18:15:00')), false);
  });

  test('estaDentroDeHorario rechaza fin de semana', () => {
    assert.equal(estaDentroDeHorario(ar('2026-11-07T10:00:00'), ar('2026-11-07T10:30:00')), false);
  });

  test('estaDentroDeHorario rechaza intervalos invertidos o nulos', () => {
    assert.equal(estaDentroDeHorario(ar('2026-11-09T10:30:00'), ar('2026-11-09T10:00:00')), false);
    assert.equal(estaDentroDeHorario(ar('2026-11-09T10:00:00'), ar('2026-11-09T10:00:00')), false);
    assert.equal(estaDentroDeHorario('2026-11-09T10:00:00-03:00', ar('2026-11-09T10:30:00')), false);
  });

  test('slotEnPasado detecta slots que ya comenzaron', () => {
    const ahora = ar('2026-11-09T10:15:00');
    assert.equal(slotEnPasado(ar('2026-11-09T10:00:00'), ahora), true);
    assert.equal(slotEnPasado(ar('2026-11-09T10:15:00'), ahora), true);
    assert.equal(slotEnPasado(ar('2026-11-09T10:30:00'), ahora), false);
  });
});

describe('rangoDelDia(fecha) (C-05)', () => {
  const ar = (iso) => new Date(`${iso}-03:00`);

  test('devuelve desde = 00:00 y hasta = 24:00 de Buenos Aires para una fecha válida', () => {
    const rango = rangoDelDia('2026-11-09');

    assert.equal(rango.desde.toISOString(), ar('2026-11-09T00:00:00').toISOString());
    assert.equal(rango.hasta.toISOString(), ar('2026-11-10T00:00:00').toISOString());
  });

  test('un turno a las 23:59 cae dentro del rango del día', () => {
    const rango = rangoDelDia('2026-11-09');
    const turno = ar('2026-11-09T23:59:00');

    assert.ok(turno >= rango.desde && turno < rango.hasta);
  });

  test('un turno a las 00:00 del día siguiente queda fuera del rango', () => {
    const rango = rangoDelDia('2026-11-09');
    const turnoSiguienteDia = ar('2026-11-10T00:00:00');

    assert.ok(!(turnoSiguienteDia >= rango.desde && turnoSiguienteDia < rango.hasta));
  });

  test('rechaza fecha inválida devolviendo null', () => {
    assert.equal(rangoDelDia('2026-02-30'), null);
    assert.equal(rangoDelDia('no-es-fecha'), null);
    assert.equal(rangoDelDia(undefined), null);
  });
});
