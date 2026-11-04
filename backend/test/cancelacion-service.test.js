import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelarTurnoInterno,
  obtenerTurnoPorToken,
  cancelarTurnoPorToken,
  leerAntelacionMinima,
  CancelacionError,
} from '../app/application/cancelacion-service.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const TURNO_ID = '44444444-4444-4444-4444-444444444444';
const TURNO_AJENO_ID = '55555555-5555-5555-5555-555555555555';
const PROPIO = '22222222-2222-2222-2222-222222222222';
const OTRO = '33333333-3333-3333-3333-333333333333';
const AHORA = new Date('2026-11-10T12:00:00Z');

function turno({
  id = TURNO_ID,
  tenant_id = TENANT_A,
  odontologo_id = PROPIO,
  inicio = '2026-11-12T12:00:00Z',
  estado = 'reservado',
} = {}) {
  return {
    id,
    tenant_id,
    odontologo_id,
    paciente_id: 'p-1',
    paciente_nombre: 'Ana Demo',
    odontologo_nombre: 'Dr. Demo',
    inicio: new Date(inicio),
    fin: new Date(new Date(inicio).getTime() + 30 * 60 * 1000),
    estado,
    token_cancelacion: 'token-secreto',
  };
}

function fakeTurnoRepository(turnos = []) {
  const estado = new Map(turnos.map((t) => [t.id, { ...t }]));
  return {
    estado,
    async findById(tenant_id, id) {
      const t = estado.get(id);
      return t && t.tenant_id === tenant_id ? { ...t } : null;
    },
    async cancel(tenant_id, id) {
      const t = estado.get(id);
      if (!t || t.tenant_id !== tenant_id) return null;
      t.estado = 'cancelado';
      return { ...t };
    },
    async findByToken(tenant_id, token) {
      if (token !== 'token-secreto') return null;
      const t = [...estado.values()].find((x) => x.tenant_id === tenant_id);
      return t ? { ...t } : null;
    },
    async cancelByToken(tenant_id, token) {
      if (token !== 'token-secreto') return null;
      const t = [...estado.values()].find((x) => x.tenant_id === tenant_id);
      if (!t || t.estado === 'cancelado') return null;
      t.estado = 'cancelado';
      return { ...t };
    },
  };
}

function userRepositoryConVinculo(odontologo_id = PROPIO) {
  return {
    async findById(tenant_id, id) {
      if (tenant_id !== TENANT_A || id !== 'u-odontologo') return null;
      return { id, tenant_id, rol: 'odontologo', odontologo_id };
    },
  };
}

const secretaria = { id: 'u-secretaria', tenant_id: TENANT_A, rol: 'secretaria' };
const odontologo = { id: 'u-odontologo', tenant_id: TENANT_A, rol: 'odontologo' };

describe('leerAntelacionMinima (CANCEL_MIN_HOURS)', () => {
  test('usa 24 por default y con valores inválidos', () => {
    assert.equal(leerAntelacionMinima({}), 24);
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: 'abc' }), 24);
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: '-4' }), 24);
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: '' }), 24);
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: '12.5' }), 24);
  });

  test('acepta enteros >= 0', () => {
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: '0' }), 0);
    assert.equal(leerAntelacionMinima({ CANCEL_MIN_HOURS: '48' }), 48);
  });
});

describe('cancelarTurnoInterno — validación y aislamiento', () => {
  test('id no UUID → 400 CANCELACION_INVALID_INPUT', async () => {
    await assert.rejects(
      cancelarTurnoInterno({
        user: secretaria,
        id: 'no-uuid',
        userRepository: userRepositoryConVinculo(),
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error instanceof CancelacionError && error.status === 400 && error.code === 'CANCELACION_INVALID_INPUT'
    );
  });

  test('turno inexistente en el tenant → 404 sin cambiar nada', async () => {
    const repo = fakeTurnoRepository([turno({ tenant_id: TENANT_B })]);

    await assert.rejects(
      cancelarTurnoInterno({
        user: secretaria,
        id: TURNO_ID,
        userRepository: userRepositoryConVinculo(),
        turnoRepository: repo,
      }),
      (error) => error.status === 404 && error.code === 'CANCELACION_TURNO_NO_ENCONTRADO'
    );
    assert.equal(repo.estado.get(TURNO_ID).estado, 'reservado');
  });
});

describe('cancelarTurnoInterno — roles e idempotencia', () => {
  test('secretaria cancela cualquier turno del tenant', async () => {
    const repo = fakeTurnoRepository([turno({ id: TURNO_AJENO_ID, odontologo_id: OTRO })]);

    const resultado = await cancelarTurnoInterno({
      user: secretaria,
      id: TURNO_AJENO_ID,
      userRepository: userRepositoryConVinculo(),
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
    assert.equal(repo.estado.get(TURNO_AJENO_ID).estado, 'cancelado');
  });

  test('odontólogo cancela su propio turno', async () => {
    const repo = fakeTurnoRepository([turno()]);

    const resultado = await cancelarTurnoInterno({
      user: odontologo,
      id: TURNO_ID,
      userRepository: userRepositoryConVinculo(PROPIO),
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
  });

  test('odontólogo no cancela el turno de otro profesional → 403', async () => {
    const repo = fakeTurnoRepository([turno({ odontologo_id: OTRO })]);

    await assert.rejects(
      cancelarTurnoInterno({
        user: odontologo,
        id: TURNO_ID,
        userRepository: userRepositoryConVinculo(PROPIO),
        turnoRepository: repo,
      }),
      (error) => error.status === 403 && error.code === 'CANCELACION_ODONTOLOGO_AJENO'
    );
    assert.equal(repo.estado.get(TURNO_ID).estado, 'reservado');
  });

  test('odontólogo sin vínculo profesional → 403 AGENDA_SIN_ODONTOLOGO', async () => {
    await assert.rejects(
      cancelarTurnoInterno({
        user: odontologo,
        id: TURNO_ID,
        userRepository: {
          async findById() {
            return { id: 'u-odontologo', tenant_id: TENANT_A, rol: 'odontologo', odontologo_id: null };
          },
        },
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error.status === 403 && error.code === 'AGENDA_SIN_ODONTOLOGO'
    );
  });

  test('la secretaria cancela dentro de las próximas 24h: la antelación no aplica a internos', async () => {
    const repo = fakeTurnoRepository([turno({ inicio: '2026-11-10T14:00:00Z' })]);

    const resultado = await cancelarTurnoInterno({
      user: secretaria,
      id: TURNO_ID,
      userRepository: userRepositoryConVinculo(),
      turnoRepository: repo,
      env: { CANCEL_MIN_HOURS: '24' },
    });

    assert.equal(resultado.estado, 'cancelado');
    assert.equal(repo.estado.get(TURNO_ID).estado, 'cancelado');
  });

  test('rol no habilitado → 403 AUTH_FORBIDDEN', async () => {
    await assert.rejects(
      cancelarTurnoInterno({
        user: { id: 'u-paciente', tenant_id: TENANT_A, rol: 'paciente' },
        id: TURNO_ID,
        userRepository: userRepositoryConVinculo(),
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error.status === 403 && error.code === 'AUTH_FORBIDDEN'
    );
  });

  test('cancelar un turno ya cancelado → 200 idempotente', async () => {
    const repo = fakeTurnoRepository([turno({ estado: 'cancelado' })]);

    const resultado = await cancelarTurnoInterno({
      user: secretaria,
      id: TURNO_ID,
      userRepository: userRepositoryConVinculo(),
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
  });

  test('la respuesta interna solo expone id, inicio, fin y estado', async () => {
    const resultado = await cancelarTurnoInterno({
      user: secretaria,
      id: TURNO_ID,
      userRepository: userRepositoryConVinculo(),
      turnoRepository: fakeTurnoRepository([turno()]),
    });

    assert.deepEqual(Object.keys(resultado).sort(), ['estado', 'fin', 'id', 'inicio']);
    assert.equal(resultado.inicio, '2026-11-12T09:00:00-03:00');
  });
});

describe('cancelarTurnoPorToken — link público', () => {
  test('token inexistente → 404', async () => {
    await assert.rejects(
      cancelarTurnoPorToken({
        tenant_id: TENANT_A,
        token: 'no-existe',
        ahora: AHORA,
        env: {},
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error.status === 404 && error.code === 'CANCELACION_TURNO_NO_ENCONTRADO'
    );
  });

  test('token de otro tenant → 404 (no filtra existencia)', async () => {
    await assert.rejects(
      cancelarTurnoPorToken({
        tenant_id: TENANT_B,
        token: 'token-secreto',
        ahora: AHORA,
        env: {},
        turnoRepository: fakeTurnoRepository([turno({ tenant_id: TENANT_A })]),
      }),
      (error) => error.status === 404
    );
  });

  test('con antelación suficiente cancela y libera el turno', async () => {
    const repo = fakeTurnoRepository([turno({ inicio: '2026-11-12T12:00:00Z' })]);

    const resultado = await cancelarTurnoPorToken({
      tenant_id: TENANT_A,
      token: 'token-secreto',
      ahora: AHORA,
      env: { CANCEL_MIN_HOURS: '24' },
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
    assert.equal(repo.estado.get(TURNO_ID).estado, 'cancelado');
  });

  test('dentro de la ventana bloqueada → 422 RN-TU-02 sin cancelar', async () => {
    const repo = fakeTurnoRepository([turno({ inicio: '2026-11-11T00:00:00Z' })]);

    await assert.rejects(
      cancelarTurnoPorToken({
        tenant_id: TENANT_A,
        token: 'token-secreto',
        ahora: AHORA,
        env: { CANCEL_MIN_HOURS: '24' },
        turnoRepository: repo,
      }),
      (error) => error.status === 422 && error.code === 'RN-TU-02'
    );
    assert.equal(repo.estado.get(TURNO_ID).estado, 'reservado');
  });

  test('exactamente el mínimo de horas se permite (corte estricto)', async () => {
    const repo = fakeTurnoRepository([turno({ inicio: '2026-11-11T12:00:00Z' })]);

    const resultado = await cancelarTurnoPorToken({
      tenant_id: TENANT_A,
      token: 'token-secreto',
      ahora: AHORA,
      env: { CANCEL_MIN_HOURS: '24' },
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
  });

  test('CANCEL_MIN_HOURS se relee en cada llamada', async () => {
    const turnoDentroDe48h = () => turno({ inicio: '2026-11-12T06:00:00Z' });

    // Con 24h de antelación, 42 horas por delante alcanza.
    const ok = await cancelarTurnoPorToken({
      tenant_id: TENANT_A,
      token: 'token-secreto',
      ahora: AHORA,
      env: { CANCEL_MIN_HOURS: '24' },
      turnoRepository: fakeTurnoRepository([turnoDentroDe48h()]),
    });
    assert.equal(ok.estado, 'cancelado');

    // Con 48h, el mismo turno ya no alcanza: el corte cambió sin reiniciar.
    await assert.rejects(
      cancelarTurnoPorToken({
        tenant_id: TENANT_A,
        token: 'token-secreto',
        ahora: AHORA,
        env: { CANCEL_MIN_HOURS: '48' },
        turnoRepository: fakeTurnoRepository([turnoDentroDe48h()]),
      }),
      (error) => error.status === 422 && error.code === 'RN-TU-02'
    );
  });

  test('un turno ya cancelado responde 200 sin validar la ventana', async () => {
    const repo = fakeTurnoRepository([
      turno({ estado: 'cancelado', inicio: '2026-11-10T12:30:00Z' }),
    ]);

    const resultado = await cancelarTurnoPorToken({
      tenant_id: TENANT_A,
      token: 'token-secreto',
      ahora: AHORA,
      env: { CANCEL_MIN_HOURS: '24' },
      turnoRepository: repo,
    });

    assert.equal(resultado.estado, 'cancelado');
  });
});

describe('obtenerTurnoPorToken — datos del link público', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.CANCEL_MIN_HOURS;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CANCEL_MIN_HOURS;
    else process.env.CANCEL_MIN_HOURS = originalEnv;
  });

  test('devuelve fecha, hora, paciente y odontólogo sin datos sensibles', async () => {
    const turnoPublico = await obtenerTurnoPorToken({
      tenant_id: TENANT_A,
      token: 'token-secreto',
      turnoRepository: fakeTurnoRepository([turno()]),
    });

    assert.deepEqual(turnoPublico, {
      id: TURNO_ID,
      inicio: '2026-11-12T09:00:00-03:00',
      fin: '2026-11-12T09:30:00-03:00',
      estado: 'reservado',
      paciente: { nombre: 'Ana Demo' },
      odontologo: { nombre: 'Dr. Demo' },
    });

    const serializada = JSON.stringify(turnoPublico);
    assert.ok(!serializada.includes('token-secreto'));
    assert.ok(!serializada.includes('token_cancelacion'));
    assert.ok(!serializada.includes('password_hash'));
    assert.ok(!serializada.includes('+5491144440001'));
  });

  test('token inexistente → 404', async () => {
    await assert.rejects(
      obtenerTurnoPorToken({
        tenant_id: TENANT_A,
        token: 'no-existe',
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error.status === 404 && error.code === 'CANCELACION_TURNO_NO_ENCONTRADO'
    );
  });

  test('lee CANCEL_MIN_HOURS de process.env en la llamada', async () => {
    process.env.CANCEL_MIN_HOURS = '72';

    await assert.rejects(
      cancelarTurnoPorToken({
        tenant_id: TENANT_A,
        token: 'token-secreto',
        ahora: AHORA,
        turnoRepository: fakeTurnoRepository([turno()]),
      }),
      (error) => error.status === 422 && error.code === 'RN-TU-02'
    );
  });
});
