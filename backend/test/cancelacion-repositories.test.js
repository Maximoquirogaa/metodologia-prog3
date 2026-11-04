import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TurnoRepository } from '../app/infrastructure/repositories/index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const TOKEN = 'token-de-cancelacion-de-prueba';

function mockDb(rows = []) {
  const capturado = { text: '', params: null };
  return {
    capturado,
    async query(text, params) {
      capturado.text = text;
      capturado.params = params;
      return { rows };
    },
  };
}

function bloqueSelect(text) {
  const match = /SELECT([\s\S]*?)FROM/i.exec(text);
  return match ? match[1] : '';
}

describe('TurnoRepository.findByToken (cancelación pública)', () => {
  test('busca por tenant y token con columnas explícitas y sin secretos', async () => {
    const db = mockDb([
      {
        id: 't-1',
        inicio: new Date('2026-11-12T12:00:00Z'),
        fin: new Date('2026-11-12T12:30:00Z'),
        estado: 'reservado',
        paciente_id: 'p-1',
        paciente_nombre: 'Ana Demo',
        odontologo_id: 'o-1',
        odontologo_nombre: 'Dr. Demo',
      },
    ]);
    const repo = new TurnoRepository(db);

    const turno = await repo.findByToken(TENANT, TOKEN);

    assert.equal(turno.id, 't-1');
    assert.ok(!db.capturado.text.includes('SELECT *'), 'Prohibido SELECT *');
    assert.match(db.capturado.text, /WHERE t\.tenant_id = \$1 AND t\.token_cancelacion = \$2/i);
    assert.match(
      db.capturado.text,
      /JOIN pacientes p ON p\.id = t\.paciente_id AND p\.tenant_id = t\.tenant_id/i
    );
    assert.match(
      db.capturado.text,
      /JOIN odontologos o ON o\.id = t\.odontologo_id AND o\.tenant_id = t\.tenant_id/i
    );
    assert.deepEqual(db.capturado.params, [TENANT, TOKEN]);
    // El token solo aparece en el WHERE, nunca en la proyección de columnas.
    assert.doesNotMatch(bloqueSelect(db.capturado.text), /token_cancelacion/i);
    assert.doesNotMatch(bloqueSelect(db.capturado.text), /password_hash/i);
  });

  test('devuelve null cuando el token no existe en el tenant', async () => {
    const db = mockDb([]);
    const repo = new TurnoRepository(db);

    assert.equal(await repo.findByToken(TENANT, 'inexistente'), null);
  });
});

describe('TurnoRepository.cancelByToken (cancelación pública)', () => {
  test('scopea por tenant y token manteniendo la guarda estado != cancelado', async () => {
    const db = mockDb([{ id: 't-1', estado: 'cancelado' }]);
    const repo = new TurnoRepository(db);

    const cancelado = await repo.cancelByToken(TENANT, TOKEN);

    assert.equal(cancelado.estado, 'cancelado');
    assert.match(db.capturado.text, /UPDATE\s+turnos\s+SET\s+estado\s*=\s*'cancelado'/i);
    assert.match(db.capturado.text, /WHERE tenant_id = \$1 AND token_cancelacion = \$2/i);
    assert.match(db.capturado.text, /estado != 'cancelado'/i);
    assert.deepEqual(db.capturado.params, [TENANT, TOKEN]);
  });

  test('un token de otro tenant no actualiza filas (mismo WHERE, distinto $1)', async () => {
    const db = mockDb([]);
    const repo = new TurnoRepository(db);

    assert.equal(await repo.cancelByToken('otro-tenant', TOKEN), null);
    assert.equal(db.capturado.params[0], 'otro-tenant');
  });
});

describe('TurnoRepository.cancel (cancelación interna)', () => {
  test('conserva el scoping por tenant_id e id', async () => {
    const db = mockDb([{ id: 't-1', estado: 'cancelado' }]);
    const repo = new TurnoRepository(db);

    await repo.cancel(TENANT, 't-1');

    assert.match(db.capturado.text, /WHERE tenant_id = \$1 AND id = \$2/i);
    assert.deepEqual(db.capturado.params, [TENANT, 't-1']);
  });
});
