import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { clearRevokedJtis } from '../app/infrastructure/auth/blacklist.js';
import { signAccessToken, getJwtSecret } from '../app/infrastructure/auth/tokens.js';
import { requireAuth, requireRole } from '../app/infrastructure/auth/middleware.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-c03';
const { createApp } = await import('../src/index.js');

const tenantA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const tenantB = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const secretariaId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const odontologoId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

const TENANTS = {
  demo: { id: tenantA, nombre: 'Demo', slug: 'demo' },
  otro: { id: tenantB, nombre: 'Otro', slug: 'otro' },
};

let server;
let baseUrl;
let app;
let users;

function makeTenantRepository() {
  return {
    async findBySlug(slug) {
      return TENANTS[slug] || null;
    },
  };
}

function makeUserRepository() {
  return {
    async findByEmailAndTenant(tenantId, email) {
      return (
        users.find(
          u => u.tenant_id === tenantId && u.email.toLowerCase() === String(email).toLowerCase()
        ) || null
      );
    },
    async findById(tenantId, id) {
      const found = users.find(u => u.tenant_id === tenantId && u.id === id);
      if (!found) return null;
      const { password_hash, ...safe } = found;
      return safe;
    },
  };
}

async function startServer() {
  app = createApp({
    userRepository: makeUserRepository(),
    tenantRepository: makeTenantRepository(),
  });
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function stopServer() {
  if (server) await new Promise(resolve => server.close(resolve));
  server = undefined;
}

async function postJson(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function getCookie(res, name = 'refresh_token') {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const match = setCookie
    .filter(Boolean)
    .map(c => c.split(';')[0])
    .find(c => c.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
}

describe('Auth HTTP routes', () => {
  before(async () => {
    process.env.JWT_SECRET = 'test-secret-c03';
    const hashSecretaria = await bcrypt.hash('Secre2026!', 4);
    const hashOdontologo = await bcrypt.hash('Odonto2026!', 4);
    const hashTenantB = await bcrypt.hash('TenantB2026!', 4);
    users = [
      {
        id: secretariaId,
        tenant_id: tenantA,
        email: 'secretaria@demo.test',
        password_hash: hashSecretaria,
        rol: 'secretaria',
      },
      {
        id: odontologoId,
        tenant_id: tenantA,
        email: 'odontologo@demo.test',
        password_hash: hashOdontologo,
        rol: 'odontologo',
      },
      // Mismo email que la secretaria, pero en otro tenant.
      {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        tenant_id: tenantB,
        email: 'secretaria@demo.test',
        password_hash: hashTenantB,
        rol: 'secretaria',
      },
    ];
  });

  beforeEach(async () => {
    clearRevokedJtis();
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  test('POST /api/auth/login con credenciales válidas devuelve access token y setea cookie de refresh', async () => {
    const res = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'Secre2026!',
      tenant_slug: 'demo',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.access_token);
    assert.equal(body.token_type, 'Bearer');
    assert.deepEqual(body.user, {
      id: secretariaId,
      tenant_id: tenantA,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });

    const payload = jwt.verify(body.access_token, getJwtSecret());
    assert.equal(payload.sub, secretariaId);
    assert.equal(payload.tenant_id, tenantA);
    assert.equal(payload.rol, 'secretaria');
    assert.equal(payload.type, 'access');

    const setCookie = res.headers.getSetCookie()
      ? res.headers.getSetCookie().join(';')
      : res.headers.get('set-cookie');
    assert.match(setCookie, /refresh_token=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
  });

  test('POST /api/auth/login con contraseña incorrecta responde 401 sin tokens', async () => {
    const res = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'incorrecta',
      tenant_slug: 'demo',
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.access_token, undefined);
    assert.equal(getCookie(res), null);
  });

  test('POST /api/auth/login con email inexistente responde 401', async () => {
    const res = await postJson('/api/auth/login', {
      email: 'nadie@demo.test',
      password: 'Secre2026!',
      tenant_slug: 'demo',
    });

    assert.equal(res.status, 401);
  });

  test('GET /api/auth/me con token válido devuelve id, tenant_id, rol y email', async () => {
    const login = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'Secre2026!',
      tenant_slug: 'demo',
    });
    const { access_token } = await login.json();

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${access_token}` },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      id: secretariaId,
      tenant_id: tenantA,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
  });

  test('GET /api/auth/me sin token responde 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  test('GET /api/auth/me con token expirado responde 401', async () => {
    const expired = jwt.sign(
      {
        tenant_id: tenantA,
        rol: 'secretaria',
        email: 'secretaria@demo.test',
        jti: 'expirado-1',
        type: 'access',
      },
      getJwtSecret(),
      { subject: secretariaId, expiresIn: '-1s' }
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${expired}` },
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/refresh rota el refresh token y rechaza el anterior', async () => {
    const login = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'Secre2026!',
      tenant_slug: 'demo',
    });
    const firstRefresh = getCookie(login);
    assert.ok(firstRefresh);

    const refreshed = await postJson(
      '/api/auth/refresh',
      {},
      { cookie: `refresh_token=${firstRefresh}` }
    );
    assert.equal(refreshed.status, 200);
    const refreshedBody = await refreshed.json();
    assert.ok(refreshedBody.access_token);

    const secondRefresh = getCookie(refreshed);
    assert.ok(secondRefresh);
    assert.notEqual(secondRefresh, firstRefresh, 'El refresh token debe rotar');

    // Reusar el refresh anterior debe fallar porque fue blacklistado.
    const reused = await postJson(
      '/api/auth/refresh',
      {},
      { cookie: `refresh_token=${firstRefresh}` }
    );
    assert.equal(reused.status, 401);

    // El nuevo refresh sigue siendo válido.
    const third = await postJson('/api/auth/refresh', {}, { cookie: `refresh_token=${secondRefresh}` });
    assert.equal(third.status, 200);
  });

  test('POST /api/auth/refresh sin cookie responde 401', async () => {
    const res = await postJson('/api/auth/refresh', {});
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/logout blacklistea el access token activo', async () => {
    const login = await postJson('/api/auth/login', {
      email: 'odontologo@demo.test',
      password: 'Odonto2026!',
      tenant_slug: 'demo',
    });
    const { access_token } = await login.json();

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access_token}` },
    });
    assert.equal(logout.status, 204);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${access_token}` },
    });
    assert.equal(me.status, 401, 'El access token revocado no debe servir');
  });

  test('POST /api/auth/logout sin token responde 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('rate limiting: el intento 6 dentro de la ventana responde 429', async () => {
    const credentials = {
      email: 'secretaria@demo.test',
      password: 'incorrecta',
      tenant_slug: 'demo',
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await postJson('/api/auth/login', credentials);
      assert.equal(res.status, 401, `intento ${i + 1} debe ser 401 por credenciales`);
    }

    const sixth = await postJson('/api/auth/login', credentials);
    assert.equal(sixth.status, 429);
    const body = await sixth.json();
    assert.equal(body.code, 'AUTH_RATE_LIMITED');
  });

  test('login scopea la sesión al tenant del usuario (mismo email en dos tenants)', async () => {
    const loginB = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'TenantB2026!',
      tenant_slug: 'otro',
    });
    assert.equal(loginB.status, 200);
    const tokenB = (await loginB.json()).access_token;
    assert.equal(jwt.verify(tokenB, getJwtSecret()).tenant_id, tenantB);

    // La contraseña de B no sirve para autenticarse en el tenant A.
    const loginA = await postJson('/api/auth/login', {
      email: 'secretaria@demo.test',
      password: 'TenantB2026!',
      tenant_slug: 'demo',
    });
    assert.equal(loginA.status, 401);
  });

  test('rutas públicas no exigen autenticación (DD-02)', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    for (const path of ['/', '/reservar', '/cancelar/token-demo']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.notEqual(res.status, 401, `${path} no debe responder 401 por auth`);
    }
  });
});

describe('Auth middlewares', () => {
  let middlewareServer;
  let middlewareBaseUrl;
  let privateApp;

  before(async () => {
    privateApp = express();
    privateApp.get('/private', requireAuth(), (req, res) => {
      res.json({ ok: true, user: req.user });
    });
    privateApp.get('/secretaria-only', requireAuth(), requireRole('secretaria'), (req, res) => {
      res.json({ ok: true });
    });
    await new Promise(resolve => {
      middlewareServer = privateApp.listen(0, '127.0.0.1', resolve);
    });
    middlewareBaseUrl = `http://127.0.0.1:${middlewareServer.address().port}`;
  });

  after(async () => {
    if (middlewareServer) await new Promise(resolve => middlewareServer.close(resolve));
  });

  test('require_auth rechaza sin token (401)', async () => {
    const res = await fetch(`${middlewareBaseUrl}/private`);
    assert.equal(res.status, 401);
  });

  test('require_auth rechaza token inválido (401)', async () => {
    const res = await fetch(`${middlewareBaseUrl}/private`, {
      headers: { authorization: 'Bearer token-invalido' },
    });
    assert.equal(res.status, 401);
  });

  test('require_auth adjunta req.user y permite el paso', async () => {
    const token = signAccessToken({
      id: secretariaId,
      tenant_id: tenantA,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
    const res = await fetch(`${middlewareBaseUrl}/private`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.id, secretariaId);
    assert.equal(body.user.tenant_id, tenantA);
    assert.equal(body.user.rol, 'secretaria');
    assert.equal(body.user.email, 'secretaria@demo.test');
    assert.equal(typeof body.user.jti, 'string');
    assert.equal(typeof body.user.exp, 'number');
  });

  test('require_role permite el rol habilitado', async () => {
    const token = signAccessToken({
      id: secretariaId,
      tenant_id: tenantA,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
    const res = await fetch(`${middlewareBaseUrl}/secretaria-only`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
  });

  test('require_role deniega el rol no habilitado con 403', async () => {
    const token = signAccessToken({
      id: odontologoId,
      tenant_id: tenantA,
      rol: 'odontologo',
      email: 'odontologo@demo.test',
    });
    const res = await fetch(`${middlewareBaseUrl}/secretaria-only`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  });

  test('require_auth rechaza un access token blacklisteado (401)', async () => {
    const { revokeJti } = await import('../app/infrastructure/auth/blacklist.js');
    const token = signAccessToken({
      id: secretariaId,
      tenant_id: tenantA,
      rol: 'secretaria',
      email: 'secretaria@demo.test',
    });
    const payload = jwt.verify(token, getJwtSecret());
    revokeJti(payload.jti, payload.exp);

    const res = await fetch(`${middlewareBaseUrl}/private`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 401);
  });
});
