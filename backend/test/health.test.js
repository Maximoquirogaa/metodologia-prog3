import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// `src/index.js` levanta el listener al importarse salvo que NODE_ENV sea
// 'test'. El import dinámico va después de la asignación a propósito: con un
// import estático el módulo se evaluaría antes y el test abriría el puerto 3000.
process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/index.js');

let server;
let baseUrl;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/health responde 200 con JSON { status: "ok" }', async () => {
  const res = await fetch(`${baseUrl}/api/health`);

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /api/health no depende de la base de datos', async () => {
  // Este endpoint debe seguir respondiendo aunque Postgres no esté disponible:
  // es el smoke test del gate y de Docker.
  const res = await fetch(`${baseUrl}/api/health`);

  assert.equal(res.status, 200);
});

test('una ruta inexistente responde 404', async () => {
  const res = await fetch(`${baseUrl}/api/no-existe`);

  assert.equal(res.status, 404);
});
