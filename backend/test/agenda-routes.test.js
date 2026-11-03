import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken } from '../app/infrastructure/auth/tokens.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-c05';
const { createApp } = await import('../src/index.js');

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ODONTOLOGO_A = '33333333-3333-3333-3333-333333333333';
const ODONTOLOGO_B = '44444444-4444-4444-4444-444444444444';
const PACIENTE_A = '55555555-5555-5555-5555-555555555555';
const SECRETARIA_A = '66666666-6666-6666-6666-666666666666';
const ODONTOLOGO_USER_A = '77777777-7777-7777-7777-777777777777';

const ar = (iso) => new Date(`${iso}-03:00`);

let server;
let baseUrl;

function makeUserRepository(...usuarios) {
  return {
    async findById(tenant_id, id) {
      const encontrado = usuarios.find((u) => u.id === id && u.tenant_id === tenant_id);
      return encontrado || null;
    },
    async findByEmailAndTenant() {
      return null;
    },
  };
}

function makeOdontologoRepository(odontologo) {
  return {
    async findById(tenant_id, id) {
      if (odontologo && odontologo.id === id && odontologo.tenant_id === tenant_id)
        return odontologo;
      return null;
    },
  };
}

function makeTurnoRepository(turnos = []) {
  return {
    async findByDay(tenant_id, { desde, hasta, odontologo_id }) {
      return turnos.filter(
        (t) =>
          t.tenant_id === tenant_id &&
          t.inicio >= desde &&
          t.inicio < hasta &&
          (!odontologo_id || t.odontologo_id === odontologo_id)
      );
    },
  };
}

function tokenDe({ id, tenant_id, rol, email }) {
  return signAccessToken({ id, tenant_id, rol, email });
}

function getAgenda(query, headers = {}) {
  return fetch(`${baseUrl}/api/agenda?${query}`, { headers });
}

async function startServer(repos) {
  const app = createApp({
    ...repos,
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }
}

describe('GET /api/agenda (C-05)', () => {
  const turnoReservado = {
    id: 't-1',
    tenant_id: TENANT_A,
    odontologo_id: ODONTOLOGO_A,
    inicio: ar('2026-11-09T09:00:00'),
    fin: ar('2026-11-09T09:30:00'),
    estado: 'reservado',
    paciente: {
      id: PACIENTE_A,
      nombre: 'Ana Gómez',
      telefono: '1144556677',
    },
    odontologo: {
      id: ODONTOLOGO_A,
      nombre: 'Dr. López',
    },
  };

  const turnoCancelado = {
    id: 't-2',
    tenant_id: TENANT_A,
    odontologo_id: ODONTOLOGO_A,
    inicio: ar('2026-11-09T15:00:00'),
    fin: ar('2026-11-09T15:30:00'),
    estado: 'cancelado',
    paciente: {
      id: PACIENTE_A,
      nombre: 'Ana Gómez',
      telefono: '1144556677',
    },
    odontologo: {
      id: ODONTOLOGO_A,
      nombre: 'Dr. López',
    },
  };

  before(async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const odontologoUser = {
      id: ODONTOLOGO_USER_A,
      tenant_id: TENANT_A,
      rol: 'odontologo',
      email: 'odontologo@demo.test',
      odontologo_id: ODONTOLOGO_A,
    };

    const turnoRepo = makeTurnoRepository([turnoReservado, turnoCancelado]);
    await startServer({
      userRepository: makeUserRepository(secretaria, odontologoUser),
      odontologoRepository: makeOdontologoRepository({
        id: ODONTOLOGO_A,
        tenant_id: TENANT_A,
        nombre: 'Dr. López',
      }),
      turnoRepository: turnoRepo,
    });
  });

  after(async () => {
    await stopServer();
  });

  test('responde 401 sin token de autenticación', async () => {
    const res = await getAgenda('fecha=2026-11-09');

    assert.equal(res.status, 401);
  });

  test('responde 401 con token inválido', async () => {
    const res = await getAgenda('fecha=2026-11-09', {
      authorization: 'Bearer token-invalido',
    });

    assert.equal(res.status, 401);
  });

  test('responde 200 con secretaria y turnos del día ordenados', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=2026-11-09', {
      authorization: `Bearer ${token}`,
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.fecha, '2026-11-09');
    assert.equal(body.odontologoId, null);
    assert.equal(body.turnos.length, 2);
    assert.equal(body.turnos[0].id, 't-1');
    assert.equal(body.turnos[0].estado, 'reservado');
    assert.equal(body.turnos[1].id, 't-2');
    assert.equal(body.turnos[1].estado, 'cancelado');
    assert.equal(body.turnos[0].paciente.nombre, 'Ana Gómez');
    assert.equal(body.turnos[0].paciente.telefono, '1144556677');
    assert.equal(body.turnos[0].odontologo.nombre, 'Dr. López');
  });

  test('responde 200 con odontólogo viendo solo sus propios turnos', async () => {
    const odontologoUser = {
      id: ODONTOLOGO_USER_A,
      tenant_id: TENANT_A,
      rol: 'odontologo',
      email: 'odontologo@demo.test',
      odontologo_id: ODONTOLOGO_A,
    };
    const token = tokenDe(odontologoUser);

    const res = await getAgenda('fecha=2026-11-09', {
      authorization: `Bearer ${token}`,
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.odontologoId, ODONTOLOGO_A);
    assert.equal(body.turnos.length, 2);
  });

  test('responde 400 cuando falta fecha', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('', {
      authorization: `Bearer ${token}`,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'AGENDA_INVALID_INPUT');
  });

  test('responde 400 con fecha mal formada', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=09/11/2026', {
      authorization: `Bearer ${token}`,
    });

    assert.equal(res.status, 400);
  });

  test('responde 400 con odontologoId que no es UUID', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=2026-11-09&odontologoId=no-es-uuid', {
      authorization: `Bearer ${token}`,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'AGENDA_INVALID_INPUT');
  });

  test('aislamiento por tenant: token de tenant A ignora x-tenant-id de tenant B', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=2026-11-09', {
      authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_B,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.turnos.length, 2);
    assert.ok(
      body.turnos.every((t) => t.paciente && !t.paciente.nombre.includes('tenant B'))
    );
  });

  test('la respuesta no expone token_cancelacion ni password_hash', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=2026-11-09', {
      authorization: `Bearer ${token}`,
    });
    const texto = await res.text();

    assert.equal(res.status, 200);
    assert.ok(!texto.includes('token_cancelacion'));
    assert.ok(!texto.includes('password_hash'));
  });

  test('devuelve lista vacía para día sin turnos', async () => {
    const secretaria = {
      id: SECRETARIA_A,
      tenant_id: TENANT_A,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    };
    const token = tokenDe(secretaria);

    const res = await getAgenda('fecha=2026-11-10', {
      authorization: `Bearer ${token}`,
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body.turnos, []);
  });
});
