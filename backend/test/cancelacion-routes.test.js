import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken } from '../app/infrastructure/auth/tokens.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-c06';
process.env.CANCEL_MIN_HOURS = '24';
const { createApp } = await import('../src/index.js');

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const PROPIO = '22222222-2222-2222-2222-222222222222';
const OTRO = '33333333-3333-3333-3333-333333333333';
const PACIENTE = '44444444-4444-4444-4444-444444444444';
const TURNO_ID = '55555555-5555-5555-5555-555555555555';
const TURNO_AJENO_ID = '66666666-6666-6666-6666-666666666666';
const TOKEN = 'token-secreto-c06';

const AHORA = new Date('2026-11-10T12:00:00Z');
const INICIO_LEJOS = new Date('2026-11-12T12:00:00Z'); // jueves 09:00 -03:00
const INICIO_CERCA = new Date('2026-11-11T00:00:00Z'); // 12 h

const secretariaA = signAccessToken({
  id: 'u-secretaria',
  tenant_id: TENANT_A,
  rol: 'secretaria',
  email: 'secretaria@demo.local',
});
const pacienteA = signAccessToken({
  id: 'u-paciente',
  tenant_id: TENANT_A,
  rol: 'paciente',
  email: 'paciente@demo.local',
});

function crearTurno({ id = TURNO_ID, tenant_id = TENANT_A, odontologo_id = PROPIO, inicio = INICIO_LEJOS } = {}) {
  return {
    id,
    tenant_id,
    odontologo_id,
    paciente_id: PACIENTE,
    paciente_nombre: 'Ana Demo',
    odontologo_nombre: 'Dr. Demo',
    inicio,
    fin: new Date(inicio.getTime() + 30 * 60 * 1000),
    estado: 'reservado',
    token_cancelacion: TOKEN,
  };
}

function makeRepos(turnos = [crearTurno()]) {
  const turnosPorId = new Map(turnos.map((t) => [t.id, t]));
  return {
    turnoRepository: {
      async findById(tenant_id, id) {
        const t = turnosPorId.get(id);
        return t && t.tenant_id === tenant_id ? t : null;
      },
      async cancel(tenant_id, id) {
        const t = turnosPorId.get(id);
        if (!t || t.tenant_id !== tenant_id) return null;
        t.estado = 'cancelado';
        return t;
      },
      async findByToken(tenant_id, token) {
        if (token !== TOKEN) return null;
        return turnos.find((t) => t.tenant_id === tenant_id) ?? null;
      },
      async cancelByToken(tenant_id, token) {
        if (token !== TOKEN) return null;
        const t = turnos.find((x) => x.tenant_id === tenant_id);
        if (!t || t.estado === 'cancelado') return null;
        t.estado = 'cancelado';
        return t;
      },
      async findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta) {
        return turnos.filter(
          (t) =>
            t.tenant_id === tenant_id &&
            t.odontologo_id === odontologo_id &&
            ['reservado', 'atendido'].includes(t.estado) &&
            t.inicio < hasta &&
            t.fin > desde
        );
      },
    },
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
    tenantRepository: {
      async findById(id) {
        if (id === TENANT_A) return { id: TENANT_A, nombre: 'Demo A', slug: 'demo-a' };
        if (id === TENANT_B) return { id: TENANT_B, nombre: 'Demo B', slug: 'demo-b' };
        return null;
      },
      async findBySlug(slug) {
        if (slug === 'demo-a') return { id: TENANT_A, nombre: 'Demo A', slug };
        return null;
      },
    },
    pacienteRepository: {},
  };
}

let server;
let baseUrl;

before(async () => {
  const app = createApp({ ...makeRepos(), now: () => AHORA });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function borrarTurno(id, { token, headers = {} } = {}) {
  return fetch(`${baseUrl}/api/turnos/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token), ...headers },
  });
}

function getCancelacion(token, { headers = {} } = {}) {
  return fetch(`${baseUrl}/api/turnos/cancelar/${token}`, { headers });
}

function postCancelacion(token, { headers = {} } = {}) {
  return fetch(`${baseUrl}/api/turnos/cancelar/${token}`, { method: 'POST', headers });
}

describe('DELETE /api/turnos/:id — autenticación y autorización', () => {
  test('secretaria autenticada cancela y recibe 200 con el turno cancelado', async () => {
    const res = await borrarTurno(TURNO_ID, { token: secretariaA });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.id, TURNO_ID);
    assert.equal(body.estado, 'cancelado');
  });

  test('sin token → 401 y el turno no cambia', async () => {
    const res = await borrarTurno(TURNO_ID);

    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, 'AUTH_MISSING_TOKEN');
  });

  test('rol no habilitado → 403 AUTH_FORBIDDEN', async () => {
    const res = await borrarTurno(TURNO_ID, { token: pacienteA });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, 'AUTH_FORBIDDEN');
  });

  test('id mal formado → 400 CANCELACION_INVALID_INPUT', async () => {
    const res = await borrarTurno('no-es-uuid', { token: secretariaA });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'CANCELACION_INVALID_INPUT');
  });

  test('turno inexistente → 404 CANCELACION_TURNO_NO_ENCONTRADO', async () => {
    const res = await borrarTurno('77777777-7777-7777-7777-777777777777', {
      token: secretariaA,
    });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'CANCELACION_TURNO_NO_ENCONTRADO');
  });
});

describe('DELETE /api/turnos/:id — aislamiento por tenant', () => {
  test('la cabecera de otro tenant no cambia el alcance: manda el JWT', async () => {
    const app = createApp({
      ...makeRepos([
        crearTurno(),
        crearTurno({ id: TURNO_AJENO_ID, tenant_id: TENANT_B, odontologo_id: OTRO }),
      ]),
      now: () => AHORA,
    });
    const srv = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${srv.address().port}`;

    try {
      // Turno del tenant A con cabecera que apunta al B: se cancela igual.
      const ok = await fetch(`${url}/api/turnos/${TURNO_ID}`, {
        method: 'DELETE',
        headers: { ...authHeaders(secretariaA), 'x-tenant-id': TENANT_B },
      });
      assert.equal(ok.status, 200);

      // Turno del tenant B pedido con el JWT del tenant A: 404, no se toca.
      const ajeno = await fetch(`${url}/api/turnos/${TURNO_AJENO_ID}`, {
        method: 'DELETE',
        headers: authHeaders(secretariaA),
      });
      assert.equal(ajeno.status, 404);
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  });
});

describe('GET /api/turnos/cancelar/:token — link público', () => {
  test('muestra el turno sin teléfono ni token', async () => {
    const res = await getCancelacion(TOKEN, { headers: { 'x-tenant-id': TENANT_A } });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.inicio, '2026-11-12T09:00:00-03:00');
    assert.equal(body.fin, '2026-11-12T09:30:00-03:00');
    assert.equal(body.paciente.nombre, 'Ana Demo');
    assert.equal(body.odontologo.nombre, 'Dr. Demo');

    const serializada = JSON.stringify(body);
    assert.ok(!serializada.includes('+5491144440001'), 'no debe exponer teléfono');
    assert.ok(!serializada.includes(TOKEN), 'no debe exponer el token');
    assert.ok(!serializada.includes('token_cancelacion'));
    assert.ok(!serializada.includes('password_hash'));
  });

  test('token inexistente → 404', async () => {
    const res = await getCancelacion('no-existe', { headers: { 'x-tenant-id': TENANT_A } });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'CANCELACION_TURNO_NO_ENCONTRADO');
  });

  test('token de otro tenant → 404 sin filtrar existencia', async () => {
    const res = await getCancelacion(TOKEN, { headers: { 'x-tenant-id': TENANT_B } });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'CANCELACION_TURNO_NO_ENCONTRADO');
  });
});

describe('POST /api/turnos/cancelar/:token — cancelación pública', () => {
  test('con antelación suficiente cancela y el slot reaparece en la disponibilidad', async () => {
    const app = createApp({ ...makeRepos(), now: () => AHORA });
    const srv = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${srv.address().port}`;

    try {
      const antes = await fetch(
        `${url}/api/disponibilidad?fecha=2026-11-12&odontologoId=${PROPIO}`,
        { headers: { 'x-tenant-id': TENANT_A } }
      );
      const disponiblesAntes = (await antes.json()).slots.map((s) => s.inicio);
      assert.ok(!disponiblesAntes.includes('2026-11-12T09:00:00-03:00'));

      const res = await fetch(`${url}/api/turnos/cancelar/${TOKEN}`, {
        method: 'POST',
        headers: { 'x-tenant-id': TENANT_A },
      });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.estado, 'cancelado');

      const despues = await fetch(
        `${url}/api/disponibilidad?fecha=2026-11-12&odontologoId=${PROPIO}`,
        { headers: { 'x-tenant-id': TENANT_A } }
      );
      const disponiblesDespues = (await despues.json()).slots.map((s) => s.inicio);
      assert.ok(disponiblesDespues.includes('2026-11-12T09:00:00-03:00'));
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  });

  test('dentro de la ventana de 24h → 422 RN-TU-02 y el turno sigue reservado', async () => {
    const app = createApp({
      ...makeRepos([crearTurno({ inicio: INICIO_CERCA })]),
      now: () => AHORA,
    });
    const srv = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${srv.address().port}`;

    try {
      const res = await fetch(`${url}/api/turnos/cancelar/${TOKEN}`, {
        method: 'POST',
        headers: { 'x-tenant-id': TENANT_A },
      });
      const body = await res.json();

      assert.equal(res.status, 422);
      assert.equal(body.code, 'RN-TU-02');

      const info = await fetch(`${url}/api/turnos/cancelar/${TOKEN}`, {
        headers: { 'x-tenant-id': TENANT_A },
      });
      assert.equal((await info.json()).estado, 'reservado');
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  });

  test('token inexistente → 404', async () => {
    const res = await postCancelacion('no-existe', { headers: { 'x-tenant-id': TENANT_A } });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'CANCELACION_TURNO_NO_ENCONTRADO');
  });
});
