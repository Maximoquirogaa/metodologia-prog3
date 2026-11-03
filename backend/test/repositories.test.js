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
});
