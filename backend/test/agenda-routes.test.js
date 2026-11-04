import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken } from '../app/infrastructure/auth/tokens.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-c05';
const { createApp } = await import('../src/index.js');

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const PROPIO = '22222222-2222-2222-2222-222222222222';
const OTRO = '33333333-3333-3333-3333-333333333333';
const PACIENTE_A = '44444444-4444-4444-4444-444444444444';
const PACIENTE_B = '55555555-5555-5555-5555-555555555555';
const USER_SECRETARIA = 'u-secretaria';

function fila({ id, tenant_id, odontologo_id = PROPIO, paciente_id = PACIENTE_A, paciente_nombre = 'Ana Demo', hora = 12, estado = 'reservado' }) {
  return {
    id,
    tenant_id,
    inicio: new Date(Date.UTC(2026, 10, 9, hora + 3, 0)),
    fin: new Date(Date.UTC(2026, 10, 9, hora + 3, 30)),
    estado,
    paciente_id,
    paciente_nombre,
    paciente_telefono: '+5491144440001',
    odontologo_id,
    odontologo_nombre: 'Dr. Demo',
  };
}

const TURNOS = [
  fila({ id: 't-a-12', tenant_id: TENANT_A, hora: 12 }),
  fila({ id: 't-a-15', tenant_id: TENANT_A, hora: 15, estado: 'cancelado' }),
  fila({
    id: 't-b-10',
    tenant_id: TENANT_B,
    odontologo_id: OTRO,
    paciente_id: PACIENTE_B,
    paciente_nombre: 'Paciente Ajeno',
    hora: 10,
  }),
];

const secretariaA = signAccessToken({
  id: USER_SECRETARIA,
  tenant_id: TENANT_A,
  rol: 'secretaria',
  email: 'secretaria@demo.local',
});
const odontologoA = signAccessToken({
  id: 'u-odontologo',
  tenant_id: TENANT_A,
  rol: 'odontologo',
  email: 'odontologo@demo.local',
});
const rolDenegado = signAccessToken({
  id: 'u-raro',
  tenant_id: TENANT_A,
  rol: 'paciente',
  email: 'raro@demo.local',
});

let server;
let baseUrl;

function makeRepos() {
  return {
    userRepository: {
      async findById(tenant_id, id) {
        if (tenant_id === TENANT_A && id === 'u-odontologo') {
          return { id, tenant_id, rol: 'odontologo', odontologo_id: PROPIO };
        }
        return null;
      },
    },
    odontologoRepository: {
      async findById(tenant_id, id) {
        if (tenant_id === TENANT_A && id === PROPIO) {
          return { id, tenant_id, nombre: 'Dr. Demo' };
        }
        return null;
      },
    },
    turnoRepository: {
      async findByDay(tenant_id, { odontologo_id } = {}) {
        return TURNOS.filter(
          (t) =>
            t.tenant_id === tenant_id &&
            (!odontologo_id || t.odontologo_id === odontologo_id)
        );
      },
    },
  };
}

before(async () => {
  const app = createApp(makeRepos());
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

function getAgenda(query = '', { token, headers = {} } = {}) {
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  return fetch(`${baseUrl}/api/agenda${query ? `?${query}` : ''}`, {
    headers: { ...auth, ...headers },
  });
}

describe('GET /api/agenda — autenticación y autorización (4.1)', () => {
  test('la secretaria accede y recibe la agenda del día ordenada', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: secretariaA });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.fecha, '2026-11-09');
    assert.deepEqual(
      body.turnos.map((t) => t.id),
      ['t-a-12', 't-a-15']
    );
    assert.equal(body.turnos[0].inicio, '2026-11-09T12:00:00-03:00');
  });

  test('el odontólogo accede a su propia agenda', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: odontologoA });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.odontologoId, PROPIO);
    assert.equal(body.turnos.length, 2);
  });

  test('sin token responde 401', async () => {
    const res = await getAgenda('fecha=2026-11-09');
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.turnos, undefined);
  });

  test('con token inválido responde 401', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: 'no-es-un-token' });
    assert.equal(res.status, 401);
  });

  test('con un rol no habilitado responde 403', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: rolDenegado });
    const body = await res.json();

    assert.equal(res.status, 403);
    assert.equal(body.code, 'AUTH_FORBIDDEN');
  });

  test('sin fecha responde 400 AGENDA_INVALID_INPUT', async () => {
    const res = await getAgenda('', { token: secretariaA });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.code, 'AGENDA_INVALID_INPUT');
  });

  test('con fecha mal formada responde 400', async () => {
    const res = await getAgenda('fecha=09-11-2026', { token: secretariaA });
    assert.equal(res.status, 400);
  });

  test('con odontologoId mal formado responde 400', async () => {
    const res = await getAgenda('fecha=2026-11-09&odontologoId=no-es-uuid', {
      token: secretariaA,
    });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/agenda — aislamiento por tenant (4.2)', () => {
  test('la cabecera x-tenant-id de otro tenant no cambia el alcance', async () => {
    const res = await getAgenda('fecha=2026-11-09', {
      token: secretariaA,
      headers: { 'x-tenant-id': TENANT_B },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(
      body.turnos.map((t) => t.id),
      ['t-a-12', 't-a-15']
    );
    assert.ok(body.turnos.every((t) => t.paciente.id !== PACIENTE_B));
  });

  test('los turnos de otro tenant no aparecen aunque compartan el día', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: secretariaA });
    const body = await res.json();

    assert.ok(!body.turnos.some((t) => t.id === 't-b-10'));
  });
});

describe('GET /api/agenda — no expone secretos ni datos ajenos (4.3)', () => {
  test('la respuesta no incluye token_cancelacion, password_hash ni pacientes de otro tenant', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: secretariaA });
    const serializada = JSON.stringify(await res.json());

    assert.ok(!serializada.includes('token_cancelacion'));
    assert.ok(!serializada.includes('password_hash'));
    assert.ok(!serializada.includes(PACIENTE_B));
    assert.ok(!serializada.includes('Paciente Ajeno'));
  });

  test('los cancelados aparecen con su estado', async () => {
    const res = await getAgenda('fecha=2026-11-09', { token: secretariaA });
    const body = await res.json();

    const cancelado = body.turnos.find((t) => t.id === 't-a-15');
    assert.equal(cancelado.estado, 'cancelado');
  });
});
