import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TurnoRepository } from '../app/infrastructure/repositories/index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ODONTOLOGO = '22222222-2222-2222-2222-222222222222';
const DESDE = new Date('2026-11-09T03:00:00Z');
const HASTA = new Date('2026-11-10T03:00:00Z');

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

describe('TurnoRepository.findByDay (agenda diaria)', () => {
  test('filtra por tenant y rango del día con columnas explícitas y sin secretos', async () => {
    const db = mockDb([
      {
        id: 't-1',
        inicio: new Date('2026-11-09T12:00:00Z'),
        fin: new Date('2026-11-09T12:30:00Z'),
        estado: 'reservado',
        paciente_id: 'p-1',
        paciente_nombre: 'Ana Demo',
        paciente_telefono: '+5491144440001',
        odontologo_id: ODONTOLOGO,
        odontologo_nombre: 'Dr. Demo',
      },
    ]);
    const repo = new TurnoRepository(db);

    const turnos = await repo.findByDay(TENANT, { desde: DESDE, hasta: HASTA });

    assert.equal(turnos.length, 1);
    assert.ok(!db.capturado.text.includes('SELECT *'), 'Prohibido SELECT *');
    assert.doesNotMatch(db.capturado.text, /token_cancelacion/);
    assert.doesNotMatch(db.capturado.text, /password_hash/);
    assert.match(db.capturado.text, /FROM turnos t/i);
    assert.match(db.capturado.text, /JOIN pacientes p ON p\.id = t\.paciente_id AND p\.tenant_id = t\.tenant_id/i);
    assert.match(db.capturado.text, /JOIN odontologos o ON o\.id = t\.odontologo_id AND o\.tenant_id = t\.tenant_id/i);
    assert.match(db.capturado.text, /WHERE t\.tenant_id = \$1 AND t\.inicio >= \$2 AND t\.inicio < \$3/i);
    assert.match(db.capturado.text, /ORDER BY t\.inicio ASC/i);
    assert.deepEqual(db.capturado.params, [TENANT, DESDE, HASTA]);
  });

  test('no filtra por estado: incluye cancelados además de reservado/atendido', async () => {
    const db = mockDb([]);
    const repo = new TurnoRepository(db);

    await repo.findByDay(TENANT, { desde: DESDE, hasta: HASTA });

    assert.doesNotMatch(db.capturado.text, /estado\s*(=|IN)\s*/i);
  });

  test('agrega el filtro opcional por odontólogo como $4', async () => {
    const db = mockDb([]);
    const repo = new TurnoRepository(db);

    await repo.findByDay(TENANT, { desde: DESDE, hasta: HASTA, odontologo_id: ODONTOLOGO });

    assert.match(db.capturado.text, /AND t\.odontologo_id = \$4/);
    assert.deepEqual(db.capturado.params, [TENANT, DESDE, HASTA, ODONTOLOGO]);
  });
});
