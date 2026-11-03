import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TurnoRepository,
  PacienteRepository,
} from '../app/infrastructure/repositories/index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTRO_TENANT = '99999999-9999-9999-9999-999999999999';
const ODONTOLOGO = '22222222-2222-2222-2222-222222222222';

function mockDb(rows) {
  const capturado = { text: '', params: null, llamadas: 0 };
  return {
    capturado,
    async query(text, params) {
      capturado.text = text;
      capturado.params = params;
      capturado.llamadas += 1;
      return { rows };
    },
  };
}

describe('Consultas de repositorio para reserva pública', () => {
  test('findActivosByOdontologoAndDay filtra por tenant, odontólogo y estado activo sin SELECT *', async () => {
    const db = mockDb([
      {
        id: 't-1',
        tenant_id: TENANT,
        odontologo_id: ODONTOLOGO,
        paciente_id: 'p-1',
        inicio: new Date('2026-11-09T13:00:00Z'),
        fin: new Date('2026-11-09T13:30:00Z'),
        estado: 'reservado',
      },
    ]);
    const repo = new TurnoRepository(db);
    const desde = new Date('2026-11-09T03:00:00Z');
    const hasta = new Date('2026-11-10T03:00:00Z');

    const turnos = await repo.findActivosByOdontologoAndDay(TENANT, ODONTOLOGO, desde, hasta);

    assert.equal(turnos.length, 1);
    assert.ok(!db.capturado.text.includes('SELECT *'), 'Prohibido SELECT * según regla dura');
    assert.match(db.capturado.text, /estado IN \('reservado', 'atendido'\)/);
    assert.doesNotMatch(db.capturado.text, /'cancelado'/);
    assert.match(db.capturado.text, /tenant_id = \$1/);
    assert.match(db.capturado.text, /odontologo_id = \$2/);
    assert.match(db.capturado.text, /inicio < \$4/);
    assert.match(db.capturado.text, /fin > \$3/);
    assert.deepEqual(db.capturado.params, [TENANT, ODONTOLOGO, desde, hasta]);
  });

  test('findActivosByOdontologoAndDay no expone token_cancelacion en las columnas', async () => {
    const db = mockDb([]);
    const repo = new TurnoRepository(db);

    await repo.findActivosByOdontologoAndDay(TENANT, ODONTOLOGO, new Date(), new Date());

    assert.doesNotMatch(db.capturado.text, /token_cancelacion/);
  });

  test('findByTelefono devuelve el paciente del tenant', async () => {
    const db = mockDb([
      {
        id: 'p-1',
        tenant_id: TENANT,
        nombre: 'Ana Demo',
        telefono: '+5491144440001',
      },
    ]);
    const repo = new PacienteRepository(db);

    const paciente = await repo.findByTelefono(TENANT, '+5491144440001');

    assert.equal(paciente.tenant_id, TENANT);
    assert.equal(paciente.nombre, 'Ana Demo');
    assert.ok(!db.capturado.text.includes('SELECT *'));
    assert.deepEqual(db.capturado.params, [TENANT, '+5491144440001']);
  });

  test('findByTelefono devuelve null cuando el teléfono solo existe en otro tenant', async () => {
    const db = mockDb([]);
    const repo = new PacienteRepository(db);

    const paciente = await repo.findByTelefono(TENANT, '+5491144440001');

    assert.equal(paciente, null);
    assert.equal(db.capturado.params[0], TENANT);
    assert.notEqual(db.capturado.params[0], OTRO_TENANT);
    assert.match(db.capturado.text, /WHERE tenant_id = \$1 AND telefono = \$2/);
  });
});
