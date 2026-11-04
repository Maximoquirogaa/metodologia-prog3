import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgenda, AgendaError } from '../app/application/agenda-service.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTRO_TENANT = '99999999-9999-9999-9999-999999999999';
const PROPIO = '22222222-2222-2222-2222-222222222222';
const OTRO = '33333333-3333-3333-3333-333333333333';
const PACIENTE = '44444444-4444-4444-4444-444444444444';

const SECRETARIA = { id: 'u-sec', tenant_id: TENANT, rol: 'secretaria' };
const ODONTOLOGO = { id: 'u-odo', tenant_id: TENANT, rol: 'odontologo' };

function fila({ id = 't-1', hora = '12:00', estado = 'reservado', odontologoId = PROPIO } = {}) {
  const [hh, mm] = hora.split(':').map(Number);
  return {
    id,
    inicio: new Date(Date.UTC(2026, 10, 9, hh + 3, mm)),
    fin: new Date(Date.UTC(2026, 10, 9, hh + 3, mm + 30)),
    estado,
    paciente_id: PACIENTE,
    paciente_nombre: 'Ana Demo',
    paciente_telefono: '+5491144440001',
    odontologo_id: odontologoId,
    odontologo_nombre: 'Dr. Demo',
  };
}

function makeRepos({ rows = [], propio = PROPIO, userVinculo = propio } = {}) {
  const capturado = { findByDay: null };
  return {
    capturado,
    userRepository: {
      async findById(tenant_id, id) {
        if (tenant_id !== TENANT || id !== ODONTOLOGO.id) return null;
        return { ...ODONTOLOGO, odontologo_id: userVinculo };
      },
    },
    odontologoRepository: {
      async findById(tenant_id, id) {
        if (tenant_id !== TENANT) return null;
        if (id === PROPIO || id === OTRO) return { id, tenant_id, nombre: 'Dr. Demo' };
        return null;
      },
    },
    turnoRepository: {
      async findByDay(tenant_id, filtros) {
        capturado.findByDay = { tenant_id, filtros };
        return rows;
      },
    },
  };
}

async function esperarAgendaError(promesa, status, code) {
  await assert.rejects(promesa, (error) => {
    assert.ok(error instanceof AgendaError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

describe('buildAgenda — rol secretaria (3.1)', () => {
  test('devuelve la agenda del tenant ordenada por hora', async () => {
    const repos = makeRepos({
      rows: [fila({ id: 't-9', hora: '09:00' }), fila({ id: 't-12', hora: '12:00' }), fila({ id: 't-15', hora: '15:00' })],
    });

    const agenda = await buildAgenda({
      user: SECRETARIA,
      fecha: '2026-11-09',
      ...repos,
    });

    assert.equal(agenda.fecha, '2026-11-09');
    assert.equal(agenda.odontologoId, null);
    assert.deepEqual(
      agenda.turnos.map(t => t.inicio),
      ['2026-11-09T09:00:00-03:00', '2026-11-09T12:00:00-03:00', '2026-11-09T15:00:00-03:00']
    );
    assert.equal(repos.capturado.findByDay.tenant_id, TENANT);
    assert.equal(repos.capturado.findByDay.filtros.odontologo_id, null);
  });

  test('devuelve lista vacía si el día no tiene turnos', async () => {
    const agenda = await buildAgenda({
      user: SECRETARIA,
      fecha: '2026-11-09',
      ...makeRepos({ rows: [] }),
    });

    assert.deepEqual(agenda.turnos, []);
  });

  test('aplica el filtro por odontólogo del tenant', async () => {
    const repos = makeRepos({ rows: [fila()] });

    const agenda = await buildAgenda({
      user: SECRETARIA,
      fecha: '2026-11-09',
      odontologoId: PROPIO,
      ...repos,
    });

    assert.equal(agenda.odontologoId, PROPIO);
    assert.equal(repos.capturado.findByDay.filtros.odontologo_id, PROPIO);
    assert.equal(repos.capturado.findByDay.tenant_id, TENANT);
  });

  test('devuelve 404 si el odontólogo no pertenece al tenant', async () => {
    const repos = makeRepos();
    repos.odontologoRepository.findById = async () => null;

    await esperarAgendaError(
      buildAgenda({ user: SECRETARIA, fecha: '2026-11-09', odontologoId: OTRO, ...repos }),
      404,
      'AGENDA_ODONTOLOGO_NO_ENCONTRADO'
    );
    assert.equal(repos.capturado.findByDay, null, 'No debe consultar turnos de un odontólogo ajeno');
  });
});

describe('buildAgenda — rol odontólogo (3.2)', () => {
  test('sin odontologoId devuelve solo la agenda propia', async () => {
    const repos = makeRepos({ rows: [fila({ odontologoId: PROPIO })] });

    const agenda = await buildAgenda({ user: ODONTOLOGO, fecha: '2026-11-09', ...repos });

    assert.equal(agenda.odontologoId, PROPIO);
    assert.equal(repos.capturado.findByDay.filtros.odontologo_id, PROPIO);
  });

  test('pedir la agenda de otro profesional responde 403', async () => {
    const repos = makeRepos();

    await esperarAgendaError(
      buildAgenda({ user: ODONTOLOGO, fecha: '2026-11-09', odontologoId: OTRO, ...repos }),
      403,
      'AGENDA_ODONTOLOGO_AJENO'
    );
    assert.equal(repos.capturado.findByDay, null);
  });

  test('usuario odontólogo sin vínculo responde 403 AGENDA_SIN_ODONTOLOGO', async () => {
    const repos = makeRepos({ userVinculo: null });

    await esperarAgendaError(
      buildAgenda({ user: ODONTOLOGO, fecha: '2026-11-09', ...repos }),
      403,
      'AGENDA_SIN_ODONTOLOGO'
    );
  });
});

describe('buildAgenda — respuesta expandida (3.3)', () => {
  test('expande paciente y odontólogo y no expone secretos', async () => {
    const agenda = await buildAgenda({
      user: SECRETARIA,
      fecha: '2026-11-09',
      ...makeRepos({ rows: [fila()] }),
    });

    const turno = agenda.turnos[0];
    assert.deepEqual(turno, {
      id: 't-1',
      inicio: '2026-11-09T12:00:00-03:00',
      fin: '2026-11-09T12:30:00-03:00',
      estado: 'reservado',
      paciente: { id: PACIENTE, nombre: 'Ana Demo', telefono: '+5491144440001' },
      odontologo: { id: PROPIO, nombre: 'Dr. Demo' },
    });

    const serializada = JSON.stringify(agenda);
    assert.ok(!serializada.includes('token_cancelacion'));
    assert.ok(!serializada.includes('password_hash'));
  });

  test('incluye turnos cancelados con su estado', async () => {
    const agenda = await buildAgenda({
      user: SECRETARIA,
      fecha: '2026-11-09',
      ...makeRepos({ rows: [fila({ id: 't-cancelado', estado: 'cancelado' })] }),
    });

    assert.equal(agenda.turnos.length, 1);
    assert.equal(agenda.turnos[0].estado, 'cancelado');
  });
});

describe('buildAgenda — validación de parámetros (3.4)', () => {
  test('fecha faltante responde 400 AGENDA_INVALID_INPUT', async () => {
    await esperarAgendaError(
      buildAgenda({ user: SECRETARIA, ...makeRepos() }),
      400,
      'AGENDA_INVALID_INPUT'
    );
  });

  test('fecha mal formada responde 400 AGENDA_INVALID_INPUT', async () => {
    await esperarAgendaError(
      buildAgenda({ user: SECRETARIA, fecha: '09/11/2026', ...makeRepos() }),
      400,
      'AGENDA_INVALID_INPUT'
    );
  });

  test('odontologoId mal formado responde 400 AGENDA_INVALID_INPUT', async () => {
    await esperarAgendaError(
      buildAgenda({
        user: SECRETARIA,
        fecha: '2026-11-09',
        odontologoId: 'no-es-uuid',
        ...makeRepos(),
      }),
      400,
      'AGENDA_INVALID_INPUT'
    );
  });
});
