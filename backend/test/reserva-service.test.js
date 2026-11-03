import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReservaError,
  buildDisponibilidad,
  crearTurno,
  esConflictoDeSolapamiento,
} from '../app/application/reserva-service.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ODONTOLOGO = '22222222-2222-2222-2222-222222222222';
const PACIENTE = '44444444-4444-4444-4444-444444444444';
const AHORA = new Date('2026-11-01T12:00:00-03:00');
const ar = (iso) => new Date(`${iso}-03:00`);

function odontologoRepository(encontrado = true) {
  return {
    async findById(tenant_id, id) {
      return encontrado ? { id, tenant_id, nombre: 'Dr. Demo', activo: true } : null;
    },
  };
}

function turnoRepository({ activos = [], alCrear } = {}) {
  return {
    consultas: [],
    async findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta) {
      this.consultas.push({ tenant_id, odontologo_id, desde, hasta });
      return activos;
    },
    async create(data) {
      if (alCrear) return alCrear(data);
      return { id: 'turno-1', ...data };
    },
  };
}

function pacienteRepository({ existente = null } = {}) {
  return {
    creados: [],
    async findByTelefono() {
      return existente;
    },
    async create(data) {
      this.creados.push(data);
      return { id: 'paciente-nuevo', ...data };
    },
  };
}

function base(overrides = {}) {
  return {
    tenant_id: TENANT,
    odontologo_id: ODONTOLOGO,
    ahora: AHORA,
    odontologoRepository: odontologoRepository(),
    turnoRepository: turnoRepository(),
    ...overrides,
  };
}

async function capturarError(fn) {
  try {
    await fn();
    assert.fail('se esperaba un error');
  } catch (error) {
    return error;
  }
}

describe('Disponibilidad pública (buildDisponibilidad)', () => {
  test('devuelve 18 slots libres en un día hábil sin turnos', async () => {
    const turnos = turnoRepository();
    const resultado = await buildDisponibilidad({
      ...base({ turnoRepository: turnos }),
      fecha: '2026-11-09',
    });

    assert.equal(resultado.slots.length, 18);
    assert.equal(resultado.slots[0].inicio, '2026-11-09T09:00:00-03:00');
    assert.equal(resultado.slots[17].fin, '2026-11-09T18:00:00-03:00');
    assert.equal(turnos.consultas[0].tenant_id, TENANT);
  });

  test('excluye el slot ocupado por un turno reservado', async () => {
    const turnos = turnoRepository({
      activos: [
        {
          id: 't-1',
          inicio: ar('2026-11-09T10:00:00'),
          fin: ar('2026-11-09T10:30:00'),
          estado: 'reservado',
        },
      ],
    });

    const resultado = await buildDisponibilidad({
      ...base({ turnoRepository: turnos }),
      fecha: '2026-11-09',
    });

    assert.equal(resultado.slots.length, 17);
    assert.ok(!resultado.slots.some((s) => s.inicio === '2026-11-09T10:00:00-03:00'));
  });

  test('un turno cancelado no ocupa el slot porque el repositorio no lo devuelve', async () => {
    const turnos = turnoRepository({ activos: [] });

    const resultado = await buildDisponibilidad({
      ...base({ turnoRepository: turnos }),
      fecha: '2026-11-09',
    });

    assert.equal(resultado.slots.length, 18);
    assert.ok(resultado.slots.some((s) => s.inicio === '2026-11-09T10:00:00-03:00'));
  });

  test('devuelve lista vacía en fin de semana', async () => {
    const resultado = await buildDisponibilidad({
      ...base(),
      fecha: '2026-11-07',
    });

    assert.deepEqual(resultado.slots, []);
  });

  test('no ofrece slots que ya comenzaron en el día de hoy', async () => {
    const resultado = await buildDisponibilidad({
      ...base({ ahora: ar('2026-11-09T12:00:00') }),
      fecha: '2026-11-09',
    });

    assert.equal(resultado.slots[0].inicio, '2026-11-09T12:30:00-03:00');
    assert.ok(resultado.slots.length < 18);
  });

  test('responde 404 si el odontólogo no pertenece al tenant', async () => {
    const error = await capturarError(() =>
      buildDisponibilidad({
        ...base({ odontologoRepository: odontologoRepository(false) }),
        fecha: '2026-11-09',
      })
    );

    assert.ok(error instanceof ReservaError);
    assert.equal(error.status, 404);
  });

  test('responde 400 si la fecha no es YYYY-MM-DD', async () => {
    const error = await capturarError(() =>
      buildDisponibilidad({ ...base(), fecha: '09/11/2026' })
    );

    assert.equal(error.status, 400);
    assert.equal(error.code, 'RESERVA_INVALID_FECHA');
  });
});

describe('Creación de turno (crearTurno)', () => {
  test('crea el turno reservado con token y paciente nuevo', async () => {
    const pacientes = pacienteRepository();
    const resultado = await crearTurno({
      ...base({ pacienteRepository: pacientes }),
      paciente: { nombre: 'Ana Demo', telefono: ' +5491144440001 ' },
      inicio: ar('2026-11-09T10:00:00'),
      fin: ar('2026-11-09T10:30:00'),
    });

    assert.equal(resultado.estado, 'reservado');
    assert.equal(resultado.inicio, '2026-11-09T10:00:00-03:00');
    assert.equal(resultado.fin, '2026-11-09T10:30:00-03:00');
    assert.equal(pacientes.creados.length, 1);
    assert.equal(pacientes.creados[0].telefono, '+5491144440001');
    assert.ok(resultado.token_cancelacion.length >= 32);
  });

  test('reutiliza el paciente existente sin sobrescribir su nombre', async () => {
    const existente = { id: PACIENTE, tenant_id: TENANT, nombre: 'Nombre Original' };
    const pacientes = pacienteRepository({ existente });

    const resultado = await crearTurno({
      ...base({ pacienteRepository: pacientes }),
      paciente: { nombre: 'Otro Nombre', telefono: '+5491144440001' },
      inicio: ar('2026-11-09T10:00:00'),
      fin: ar('2026-11-09T10:30:00'),
    });

    assert.equal(pacientes.creados.length, 0);
    assert.equal(resultado.paciente_id, PACIENTE);
  });

  test('rechaza con 404 un odontólogo de otro tenant', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base({ odontologoRepository: odontologoRepository(false) }),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.equal(error.status, 404);
  });

  test('rechaza con 400 un intervalo inválido', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:30:00'),
        fin: ar('2026-11-09T10:00:00'),
      })
    );

    assert.equal(error.status, 400);
  });

  test('rechaza con 400 un turno que ya comenzó', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-10-01T10:00:00'),
        fin: ar('2026-10-01T10:30:00'),
      })
    );

    assert.equal(error.status, 400);
  });

  test('rechaza con 422 RN-TU-04 un turno fuera de horario', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T20:00:00'),
        fin: ar('2026-11-09T20:30:00'),
      })
    );

    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-04');
  });

  test('rechaza con 422 RN-TU-04 un turno en fin de semana', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-07T10:00:00'),
        fin: ar('2026-11-07T10:30:00'),
      })
    );

    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-04');
  });

  test('rechaza con 422 RN-TU-03 un paciente sin teléfono', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: 'Ana', telefono: '   ' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-03');
  });

  test('rechaza con 422 RN-TU-03 un paciente sin nombre', async () => {
    const error = await capturarError(() =>
      crearTurno({
        ...base(),
        paciente: { nombre: '', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-03');
  });

  test('rechaza con 422 RN-TU-01 un turno que se superpone', async () => {
    const turnos = turnoRepository({
      activos: [
        {
          id: 't-1',
          inicio: ar('2026-11-09T10:00:00'),
          fin: ar('2026-11-09T10:30:00'),
          estado: 'reservado',
        },
      ],
    });

    const error = await capturarError(() =>
      crearTurno({
        ...base({ turnoRepository: turnos, pacienteRepository: pacienteRepository() }),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-01');
  });

  test('genera tokens distintos por turno', async () => {
    const crear = () =>
      crearTurno({
        ...base({ pacienteRepository: pacienteRepository() }),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      });

    const [primero, segundo] = await Promise.all([crear(), crear()]);

    assert.notEqual(primero.token_cancelacion, segundo.token_cancelacion);
    assert.ok(primero.token_cancelacion.length >= 32);
  });
});

describe('Doble capa anti-overlap (constraint turnos_no_overlap)', () => {
  test('mapea el error 23P01 de turnos_no_overlap a 422 RN-TU-01', async () => {
    const turnos = turnoRepository({
      alCrear: async () => {
        const error = new Error('conflicting key value violates exclusion constraint');
        error.code = '23P01';
        error.constraint = 'turnos_no_overlap';
        throw error;
      },
    });

    const error = await capturarError(() =>
      crearTurno({
        ...base({ turnoRepository: turnos, pacienteRepository: pacienteRepository() }),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.ok(error instanceof ReservaError);
    assert.equal(error.status, 422);
    assert.equal(error.code, 'RN-TU-01');
  });

  test('propaga cualquier otro error de base sin convertirlo en 422', async () => {
    const original = new Error('connection terminated');
    original.code = '08006';
    const turnos = turnoRepository({
      alCrear: async () => {
        throw original;
      },
    });

    const error = await capturarError(() =>
      crearTurno({
        ...base({ turnoRepository: turnos, pacienteRepository: pacienteRepository() }),
        paciente: { nombre: 'Ana', telefono: '+5491144440001' },
        inicio: ar('2026-11-09T10:00:00'),
        fin: ar('2026-11-09T10:30:00'),
      })
    );

    assert.equal(error, original);
    assert.equal(error.status, undefined);
  });

  test('esConflictoDeSolapamiento exige código y nombre de constraint', () => {
    assert.equal(esConflictoDeSolapamiento({ code: '23P01', constraint: 'turnos_no_overlap' }), true);
    assert.equal(esConflictoDeSolapamiento({ code: '23P01', constraint: 'otra' }), false);
    assert.equal(esConflictoDeSolapamiento({ code: '23505', constraint: 'turnos_no_overlap' }), false);
    assert.equal(esConflictoDeSolapamiento(null), false);
  });
});
