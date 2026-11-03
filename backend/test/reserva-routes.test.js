import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/index.js');

const TENANT = '11111111-1111-1111-1111-111111111111';
const ODONTOLOGO = '22222222-2222-2222-2222-222222222222';
const OTRO_ODONTOLOGO = '33333333-3333-3333-3333-333333333333';
const AHORA = new Date('2026-11-01T12:00:00-03:00');
const ar = (iso) => new Date(`${iso}-03:00`);

function crearRepos({ activos = [], alCrear } = {}) {
  return {
    tenantRepository: {
      async findById(id) {
        return id === TENANT ? { id: TENANT, nombre: 'Demo', slug: 'demo' } : null;
      },
      async findBySlug(slug) {
        return slug === 'demo' ? { id: TENANT, nombre: 'Demo', slug: 'demo' } : null;
      },
    },
    odontologoRepository: {
      async findById(tenant_id, id) {
        return id === ODONTOLOGO ? { id, tenant_id, nombre: 'Dr. Demo', activo: true } : null;
      },
    },
    pacienteRepository: {
      creados: [],
      async findByTelefono() {
        return null;
      },
      async create(data) {
        this.creados.push(data);
        return { id: 'paciente-1', ...data };
      },
    },
    turnoRepository: {
      async findActivosByOdontologoAndDay() {
        return activos;
      },
      async create(data) {
        if (alCrear) return alCrear(data);
        return { id: 'turno-1', ...data };
      },
    },
  };
}

let server;
let baseUrl;

before(async () => {
  const repos = crearRepos();
  const app = createApp({ ...repos, now: () => AHORA });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

function getDisponibilidad(query) {
  return fetch(`${baseUrl}/api/disponibilidad?${query}`);
}

function postTurno(body) {
  return fetch(`${baseUrl}/api/turnos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/disponibilidad (público)', () => {
  test('responde 200 con 18 slots libres de un día hábil', async () => {
    const res = await getDisponibilidad(`odontologoId=${ODONTOLOGO}&fecha=2026-11-09`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.slots.length, 18);
    assert.equal(body.slots[0].inicio, '2026-11-09T09:00:00-03:00');
  });

  test('responde 400 con fecha mal formada', async () => {
    const res = await getDisponibilidad(`odontologoId=${ODONTOLOGO}&fecha=09/11/2026`);

    assert.equal(res.status, 400);
  });

  test('responde 400 con odontologoId que no es UUID', async () => {
    const res = await getDisponibilidad('odontologoId=no-es-uuid&fecha=2026-11-09');

    assert.equal(res.status, 400);
  });

  test('responde 404 con el odontólogo de otro tenant', async () => {
    const res = await getDisponibilidad(`odontologoId=${OTRO_ODONTOLOGO}&fecha=2026-11-09`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.code, 'RESERVA_ODONTOLOGO_NO_ENCONTRADO');
  });

  test('no requiere token de autenticación', async () => {
    const res = await getDisponibilidad(`odontologoId=${ODONTOLOGO}&fecha=2026-11-09`);

    assert.notEqual(res.status, 401);
  });
});

describe('POST /api/turnos (público)', () => {
  test('responde 201 con el turno creado y su token', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: '2026-11-09T10:00:00',
      fin: '2026-11-09T10:30:00',
      paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.estado, 'reservado');
    assert.equal(body.inicio, '2026-11-09T10:00:00-03:00');
    assert.equal(body.fin, '2026-11-09T10:30:00-03:00');
    assert.ok(body.token_cancelacion.length >= 32);
  });

  test('responde 400 con fin anterior a inicio', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: '2026-11-09T11:00:00',
      fin: '2026-11-09T10:30:00',
      paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
    });

    assert.equal(res.status, 400);
  });

  test('responde 400 con fecha ISO inválida', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: 'mañana',
      fin: '2026-11-09T10:30:00',
      paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
    });

    assert.equal(res.status, 400);
  });

  test('responde 422 RN-TU-04 fuera de horario', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: '2026-11-09T20:00:00',
      fin: '2026-11-09T20:30:00',
      paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
    });
    const body = await res.json();

    assert.equal(res.status, 422);
    assert.equal(body.code, 'RN-TU-04');
  });

  test('responde 422 RN-TU-03 sin teléfono de paciente', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: '2026-11-09T10:00:00',
      fin: '2026-11-09T10:30:00',
      paciente: { nombre: 'Ana Demo' },
    });
    const body = await res.json();

    assert.equal(res.status, 422);
    assert.equal(body.code, 'RN-TU-03');
  });

  test('no requiere token de autenticación', async () => {
    const res = await postTurno({
      odontologoId: ODONTOLOGO,
      inicio: '2026-11-09T15:00:00',
      fin: '2026-11-09T15:30:00',
      paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
    });

    assert.notEqual(res.status, 401);
  });
});

describe('Rutas existentes intactas (C-03)', () => {
  test('GET /api/health sigue respondiendo 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    assert.equal(res.status, 200);
  });

  test('GET /api/auth/me sigue exigiendo autenticación', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);

    assert.equal(res.status, 401);
  });
});

describe('La disponibilidad no filtra datos sensibles (C-04 4.3)', () => {
  test('la respuesta no incluye tokens ni datos de pacientes', async () => {
    const res = await getDisponibilidad(`odontologoId=${ODONTOLOGO}&fecha=2026-11-09`);
    const texto = await res.text();

    assert.equal(res.status, 200);
    assert.doesNotMatch(texto, /token_cancelacion/);
    assert.doesNotMatch(texto, /telefono/);
    assert.doesNotMatch(texto, /"nombre"/);
    assert.doesNotMatch(texto, /paciente/i);
  });
});

describe('Integración reserva → disponibilidad', () => {
  test('el slot reservado deja de aparecer en la disponibilidad', async () => {
    const turnos = [];
    const repos = crearRepos();
    repos.turnoRepository = {
      async findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta) {
        return turnos.filter(
          (t) =>
            t.tenant_id === tenant_id &&
            t.odontologo_id === odontologo_id &&
            t.estado !== 'cancelado' &&
            t.inicio < hasta &&
            t.fin > desde
        );
      },
      async create(data) {
        const turno = { id: `turno-${turnos.length + 1}`, ...data };
        turnos.push(turno);
        return turno;
      },
    };

    const app = createApp({ ...repos, now: () => AHORA });
    const serverLocal = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const url = `http://127.0.0.1:${serverLocal.address().port}`;
      const antes = await fetch(`${url}/api/disponibilidad?odontologoId=${ODONTOLOGO}&fecha=2026-11-09`);
      const bodyAntes = await antes.json();
      assert.ok(bodyAntes.slots.some((s) => s.inicio === '2026-11-09T10:00:00-03:00'));

      const reserva = await fetch(`${url}/api/turnos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          odontologoId: ODONTOLOGO,
          inicio: '2026-11-09T10:00:00',
          fin: '2026-11-09T10:30:00',
          paciente: { nombre: 'Ana Demo', telefono: '+5491144440001' },
        }),
      });
      assert.equal(reserva.status, 201);

      const despues = await fetch(`${url}/api/disponibilidad?odontologoId=${ODONTOLOGO}&fecha=2026-11-09`);
      const bodyDespues = await despues.json();
      assert.ok(!bodyDespues.slots.some((s) => s.inicio === '2026-11-09T10:00:00-03:00'));
      assert.equal(bodyDespues.slots.length, bodyAntes.slots.length - 1);
    } finally {
      await new Promise((resolve) => serverLocal.close(resolve));
    }
  });
});
