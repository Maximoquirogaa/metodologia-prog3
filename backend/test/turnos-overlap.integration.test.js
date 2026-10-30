import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TurnoRepository } from '../app/infrastructure/repositories/index.js';

describe('Turnos Anti-Overlap Exclusion Constraint Integration Tests (RN-TU-01)', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const odontologo1 = '22222222-2222-2222-2222-222222222222';
  const odontologo2 = '33333333-3333-3333-3333-333333333333';
  const paciente1 = '44444444-4444-4444-4444-444444444444';
  const paciente2 = '55555555-5555-5555-5555-555555555555';

  test('detecta y rechaza superposición de turnos para el mismo odontólogo con código 23P01', async () => {
    const existingTurnos = [
      {
        id: 't-1',
        tenant_id: tenantId,
        odontologo_id: odontologo1,
        inicio: new Date('2026-11-01T10:00:00Z'),
        fin: new Date('2026-11-01T11:00:00Z'),
        estado: 'reservado',
      },
    ];

    const mockDb = {
      async query(text, params) {
        if (text.includes('INSERT INTO turnos')) {
          const [tId, oId, pId, inicio, fin, estado, token] = params;
          const newInicio = new Date(inicio);
          const newFin = new Date(fin);

          // Simular la exclusion constraint de PostgreSQL:
          // EXCLUDE USING gist (odontologo_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado != 'cancelado')
          const conflict = existingTurnos.some(t => {
            if (t.estado === 'cancelado') return false;
            if (t.odontologo_id !== oId) return false;
            return newInicio < t.fin && newFin > t.inicio;
          });

          if (conflict) {
            const err = new Error('conflicting key value violates exclusion constraint "turnos_no_overlap"');
            err.code = '23P01';
            err.constraint = 'turnos_no_overlap';
            throw err;
          }

          const created = {
            id: 't-2',
            tenant_id: tId,
            odontologo_id: oId,
            paciente_id: pId,
            inicio: newInicio,
            fin: newFin,
            estado,
            token_cancelacion: token,
          };
          existingTurnos.push(created);
          return { rows: [created] };
        }
        return { rows: [] };
      },
    };

    const repo = new TurnoRepository(mockDb);

    // Turno que solapa [10:30, 11:30) para el odontólogo 1 -> Debe fallar
    await assert.rejects(
      async () => {
        await repo.create({
          tenant_id: tenantId,
          odontologo_id: odontologo1,
          paciente_id: paciente2,
          inicio: new Date('2026-11-01T10:30:00Z'),
          fin: new Date('2026-11-01T11:30:00Z'),
          token_cancelacion: 'token-abc-12345678',
        });
      },
      (err) => {
        assert.equal(err.code, '23P01');
        assert.equal(err.constraint, 'turnos_no_overlap');
        return true;
      }
    );
  });

  test('permite turno en mismo horario si es para un odontólogo diferente', async () => {
    const existingTurnos = [
      {
        id: 't-1',
        odontologo_id: odontologo1,
        inicio: new Date('2026-11-01T10:00:00Z'),
        fin: new Date('2026-11-01T11:00:00Z'),
        estado: 'reservado',
      },
    ];

    const mockDb = {
      async query(text, params) {
        const [tId, oId, pId, inicio, fin, estado, token] = params;
        const newInicio = new Date(inicio);
        const newFin = new Date(fin);

        const conflict = existingTurnos.some(t => {
          if (t.estado === 'cancelado') return false;
          if (t.odontologo_id !== oId) return false;
          return newInicio < t.fin && newFin > t.inicio;
        });

        if (conflict) {
          const err = new Error('conflicting key value violates exclusion constraint');
          err.code = '23P01';
          throw err;
        }

        const created = {
          id: 't-3',
          tenant_id: tId,
          odontologo_id: oId,
          paciente_id: pId,
          inicio: newInicio,
          fin: newFin,
          estado,
          token_cancelacion: token,
        };
        return { rows: [created] };
      },
    };

    const repo = new TurnoRepository(mockDb);
    const turnoOdonto2 = await repo.create({
      tenant_id: tenantId,
      odontologo_id: odontologo2,
      paciente_id: paciente2,
      inicio: new Date('2026-11-01T10:00:00Z'),
      fin: new Date('2026-11-01T11:00:00Z'),
      token_cancelacion: 'token-xyz-12345678',
    });

    assert.ok(turnoOdonto2);
    assert.equal(turnoOdonto2.odontologo_id, odontologo2);
  });

  test('permite reutilizar el slot horario si el turno previo está cancelado', async () => {
    const existingTurnos = [
      {
        id: 't-1',
        odontologo_id: odontologo1,
        inicio: new Date('2026-11-01T14:00:00Z'),
        fin: new Date('2026-11-01T15:00:00Z'),
        estado: 'cancelado', // Cancelado libera el slot (WHERE estado != 'cancelado')
      },
    ];

    const mockDb = {
      async query(text, params) {
        const [tId, oId, pId, inicio, fin, estado, token] = params;
        const newInicio = new Date(inicio);
        const newFin = new Date(fin);

        const conflict = existingTurnos.some(t => {
          if (t.estado === 'cancelado') return false;
          if (t.odontologo_id !== oId) return false;
          return newInicio < t.fin && newFin > t.inicio;
        });

        if (conflict) {
          const err = new Error('exclusion violation');
          err.code = '23P01';
          throw err;
        }

        return {
          rows: [
            {
              id: 't-4',
              tenant_id: tId,
              odontologo_id: oId,
              paciente_id: pId,
              inicio: newInicio,
              fin: newFin,
              estado,
              token_cancelacion: token,
            },
          ],
        };
      },
    };

    const repo = new TurnoRepository(mockDb);
    const nuevoTurno = await repo.create({
      tenant_id: tenantId,
      odontologo_id: odontologo1,
      paciente_id: paciente2,
      inicio: new Date('2026-11-01T14:00:00Z'),
      fin: new Date('2026-11-01T15:00:00Z'),
      token_cancelacion: 'token-reutilizado-123',
    });

    assert.ok(nuevoTurno);
    assert.equal(nuevoTurno.id, 't-4');
  });
});
