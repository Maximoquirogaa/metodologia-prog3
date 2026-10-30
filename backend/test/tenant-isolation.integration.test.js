import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TurnoRepository,
  OdontologoRepository,
  PacienteRepository,
} from '../app/infrastructure/repositories/index.js';

describe('Multi-Tenant Isolation Integration Tests (RN-MT-01)', () => {
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  test('Tenant A no puede ver odontólogos del Tenant B', async () => {
    const store = [
      { id: 'od-1', tenant_id: tenantA, nombre: 'Dr. A', especialidad: 'General', activo: true },
      { id: 'od-2', tenant_id: tenantB, nombre: 'Dr. B', especialidad: 'Ortodoncia', activo: true },
    ];

    const mockDb = {
      async query(text, params) {
        // Simular ejecución SQL con filtro WHERE tenant_id = $1
        const tId = params[0];
        const rows = store.filter(item => item.tenant_id === tId);
        return { rows };
      },
    };

    const repo = new OdontologoRepository(mockDb);
    const odontologosA = await repo.findByTenant(tenantA);
    const odontologosB = await repo.findByTenant(tenantB);

    assert.equal(odontologosA.length, 1);
    assert.equal(odontologosA[0].nombre, 'Dr. A');
    assert.ok(odontologosA.every(o => o.tenant_id === tenantA));

    assert.equal(odontologosB.length, 1);
    assert.equal(odontologosB[0].nombre, 'Dr. B');
    assert.ok(odontologosB.every(o => o.tenant_id === tenantB));
  });

  test('Tenant A no puede ver ni cancelar turnos de Tenant B (RN-MT-01)', async () => {
    const turnosStore = [
      { id: 'tu-b', tenant_id: tenantB, estado: 'reservado' },
    ];

    const mockDb = {
      async query(text, params) {
        if (text.includes('UPDATE turnos')) {
          const [tId, id] = params;
          const found = turnosStore.find(t => t.id === id && t.tenant_id === tId);
          if (found) {
            found.estado = 'cancelado';
            return { rows: [found] };
          }
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    const repo = new TurnoRepository(mockDb);
    // Tenant A intenta cancelar el turno del Tenant B
    const result = await repo.cancel(tenantA, 'tu-b');

    assert.equal(result, null, 'No debe modificar ni retornar registros de otro tenant');
    assert.equal(turnosStore[0].estado, 'reservado', 'El turno de Tenant B debe permanecer intacto');
  });

  test('PacienteRepository.findById retorna null si el id pertenece a otro tenant', async () => {
    const pacientes = [
      { id: 'p-b', tenant_id: tenantB, nombre: 'Paciente B', telefono: '123456' },
    ];

    const mockDb = {
      async query(text, params) {
        const [tId, id] = params;
        const row = pacientes.find(p => p.id === id && p.tenant_id === tId);
        return { rows: row ? [row] : [] };
      },
    };

    const repo = new PacienteRepository(mockDb);
    const res = await repo.findById(tenantA, 'p-b');
    assert.equal(res, null);
  });
});
