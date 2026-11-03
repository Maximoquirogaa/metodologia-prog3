import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TenantRepository,
  OdontologoRepository,
  PacienteRepository,
  TurnoRepository,
} from '../app/infrastructure/repositories/index.js';

describe('Data Repositories with Explicit Columns and Tenant Scoping', () => {
  test('TenantRepository.findBySlug consulta columnas explícitas sin SELECT *', async () => {
    let capturedQuery = '';
    let capturedParams = [];
    const mockDb = {
      async query(text, params) {
        capturedQuery = text;
        capturedParams = params;
        return {
          rows: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              nombre: 'Consultorio Demo',
              slug: 'demo',
            },
          ],
        };
      },
    };

    const repo = new TenantRepository(mockDb);
    const tenant = await repo.findBySlug('demo');

    assert.equal(tenant.slug, 'demo');
    assert.ok(!capturedQuery.includes('SELECT *'), 'Prohibido SELECT * según regla dura');
    assert.match(capturedQuery, /SELECT\s+id,\s*nombre,\s*slug/i);
    assert.deepEqual(capturedParams, ['demo']);
  });

  test('OdontologoRepository.findByTenant aplica scope estricto por tenant_id', async () => {
    let capturedQuery = '';
    let capturedParams = [];
    const mockDb = {
      async query(text, params) {
        capturedQuery = text;
        capturedParams = params;
        return { rows: [] };
      },
    };

    const repo = new OdontologoRepository(mockDb);
    await repo.findByTenant('t-123');

    assert.ok(!capturedQuery.includes('SELECT *'));
    assert.match(capturedQuery, /WHERE\s+tenant_id\s*=\s*\$1/i);
    assert.deepEqual(capturedParams, ['t-123']);
  });

  test('PacienteRepository.create inserta con tenant_id y retorna columnas explícitas', async () => {
    let capturedQuery = '';
    let capturedParams = [];
    const mockDb = {
      async query(text, params) {
        capturedQuery = text;
        capturedParams = params;
        return {
          rows: [
            {
              id: 'p-1',
              tenant_id: 't-123',
              nombre: 'Ana Gómez',
              telefono: '1144556677',
            },
          ],
        };
      },
    };

    const repo = new PacienteRepository(mockDb);
    const paciente = await repo.create({
      tenant_id: 't-123',
      nombre: 'Ana Gómez',
      telefono: '1144556677',
    });

    assert.equal(paciente.nombre, 'Ana Gómez');
    assert.match(capturedQuery, /INSERT\s+INTO\s+pacientes/i);
    assert.match(capturedQuery, /RETURNING\s+id,\s*tenant_id,\s*nombre,\s*telefono/i);
    assert.equal(capturedParams[0], 't-123');
  });

  test('TurnoRepository.create y cancel respetan scoping por tenant_id', async () => {
    const executed = [];
    const mockDb = {
      async query(text, params) {
        executed.push({ text, params });
        return {
          rows: [
            {
              id: 'turno-1',
              tenant_id: 't-123',
              estado: 'cancelado',
            },
          ],
        };
      },
    };

    const repo = new TurnoRepository(mockDb);
    await repo.cancel('t-123', 'turno-1');

    assert.equal(executed.length, 1);
    const cancelQuery = executed[0].text;
    assert.match(cancelQuery, /UPDATE\s+turnos\s+SET\s+estado\s*=\s*'cancelado'/i);
    assert.match(cancelQuery, /WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+id\s*=\s*\$2/i);
    assert.deepEqual(executed[0].params, ['t-123', 'turno-1']);
  });

  test('TurnoRepository.findByDay consulta con JOIN, columnas explícitas y doble tenant_id', async () => {
    let capturedQuery = '';
    let capturedParams = [];
    const mockDb = {
      async query(text, params) {
        capturedQuery = text;
        capturedParams = params;
        return { rows: [] };
      },
    };

    const repo = new TurnoRepository(mockDb);
    await repo.findByDay('t-123', {
      desde: new Date('2026-11-09T00:00:00-03:00'),
      hasta: new Date('2026-11-10T00:00:00-03:00'),
    });

    assert.ok(!capturedQuery.includes('SELECT *'), 'Prohibido SELECT * según regla dura');
    assert.ok(!capturedQuery.includes('token_cancelacion'), 'token_cancelacion no debe seleccionarse');
    assert.match(capturedQuery, /FROM\s+turnos\s+t/i);
    assert.match(capturedQuery, /JOIN\s+pacientes\s+p\s+ON\s+p\.id\s*=\s*t\.paciente_id/i);
    assert.match(capturedQuery, /JOIN\s+odontologos\s+o\s+ON\s+o\.id\s*=\s*t\.odontologo_id/i);
    assert.match(capturedQuery, /AND\s+p\.tenant_id\s*=\s*t\.tenant_id/i);
    assert.match(capturedQuery, /AND\s+o\.tenant_id\s*=\s*t\.tenant_id/i);
    assert.match(capturedQuery, /WHERE\s+t\.tenant_id\s*=\s*\$1/i);
    assert.match(capturedQuery, /AND\s+t\.inicio\s*>=\s*\$2/i);
    assert.match(capturedQuery, /AND\s+t\.inicio\s*<\s*\$3/i);
    assert.match(capturedQuery, /ORDER\s+BY\s+t\.inicio\s+ASC/i);
    assert.deepEqual(capturedParams, ['t-123', capturedParams[1], capturedParams[2]]);
  });

  test('TurnoRepository.findByDay aplica filtro opcional por odontologo_id', async () => {
    let capturedQuery = '';
    let capturedParams = [];
    const mockDb = {
      async query(text, params) {
        capturedQuery = text;
        capturedParams = params;
        return { rows: [] };
      },
    };

    const repo = new TurnoRepository(mockDb);
    const odontologoId = '22222222-2222-2222-2222-222222222222';
    await repo.findByDay('t-123', {
      desde: new Date('2026-11-09T00:00:00-03:00'),
      hasta: new Date('2026-11-10T00:00:00-03:00'),
      odontologo_id: odontologoId,
    });

    assert.match(capturedQuery, /AND\s+t\.odontologo_id\s*=\s*\$4/i);
    assert.deepEqual(capturedParams[3], odontologoId);
  });

  test('TurnoRepository.findByDay mapea columnas expandidas de paciente y odontólogo', async () => {
    const mockDb = {
      async query() {
        return {
          rows: [
            {
              id: 'turno-1',
              inicio: new Date('2026-11-09T09:00:00-03:00'),
              fin: new Date('2026-11-09T09:30:00-03:00'),
              estado: 'reservado',
              paciente_id: 'p-1',
              paciente_nombre: 'Ana Gómez',
              paciente_telefono: '1144556677',
              odontologo_id: 'o-1',
              odontologo_nombre: 'Dr. López',
            },
          ],
        };
      },
    };

    const repo = new TurnoRepository(mockDb);
    const turnos = await repo.findByDay('t-123', {
      desde: new Date('2026-11-09T00:00:00-03:00'),
      hasta: new Date('2026-11-10T00:00:00-03:00'),
    });

    assert.equal(turnos.length, 1);
    assert.equal(turnos[0].id, 'turno-1');
    assert.equal(turnos[0].estado, 'reservado');
    assert.equal(turnos[0].paciente.id, 'p-1');
    assert.equal(turnos[0].paciente.nombre, 'Ana Gómez');
    assert.equal(turnos[0].paciente.telefono, '1144556677');
    assert.equal(turnos[0].odontologo.id, 'o-1');
    assert.equal(turnos[0].odontologo.nombre, 'Dr. López');
    assert.equal(turnos[0].token_cancelacion, undefined);
  });
});
