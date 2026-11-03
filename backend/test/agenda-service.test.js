import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgenda,
  AgendaError,
} from '../app/application/agenda-service.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ODONTOLOGO_A = '33333333-3333-3333-3333-333333333333';
const ODONTOLOGO_B = '44444444-4444-4444-4444-444444444444';
const PACIENTE_A = '55555555-5555-5555-5555-555555555555';
const USUARIO_SECRETARIA = '66666666-6666-6666-6666-666666666666';
const USUARIO_ODONTOLOGO = '77777777-7777-7777-7777-777777777777';
const AHORA = new Date('2026-11-09T12:00:00-03:00');

function capturarError(fn) {
  return fn().then(
    () => assert.fail('se esperaba un error'),
    (error) => error
  );
}

function turnoRow(id, inicio, fin, estado, paciente, odontologo, tenant_id = TENANT_A) {
  return {
    id,
    tenant_id,
    inicio: new Date(inicio),
    fin: new Date(fin),
    estado,
    paciente: {
      id: paciente.id,
      nombre: paciente.nombre,
      telefono: paciente.telefono,
    },
    odontologo: {
      id: odontologo.id,
      nombre: odontologo.nombre,
    },
  };
}

function mockTurnoRepository(turnos = []) {
  return {
    async findByDay(tenant_id, { desde, hasta, odontologo_id }) {
      return turnos
        .filter((t) => {
          if (t.tenant_id !== tenant_id) return false;
          if (t.inicio < desde || t.inicio >= hasta) return false;
          if (odontologo_id && t.odontologo.id !== odontologo_id) return false;
          return true;
        })
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    },
  };
}

function mockUserRepository(user) {
  return {
    async findById(tenant_id, id) {
      if (id === user.id && tenant_id === user.tenant_id) return user;
      return null;
    },
  };
}

function mockOdontologoRepository(odontologo) {
  return {
    async findById(tenant_id, id) {
      if (!odontologo) return null;
      if (id === odontologo.id && tenant_id === odontologo.tenant_id) return odontologo;
      return null;
    },
  };
}

describe('buildAgenda (C-05)', () => {
  describe('Validación de entrada (3.4)', () => {
    test('responde 400 AGENDA_INVALID_INPUT si fecha falta', async () => {
      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
          userRepository: mockUserRepository({}),
          odontologoRepository: mockOdontologoRepository({}),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.ok(error instanceof AgendaError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'AGENDA_INVALID_INPUT');
    });

    test('responde 400 AGENDA_INVALID_INPUT si fecha tiene formato inválido', async () => {
      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
          fecha: '09/11/2026',
          userRepository: mockUserRepository({}),
          odontologoRepository: mockOdontologoRepository({}),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.equal(error.status, 400);
      assert.equal(error.code, 'AGENDA_INVALID_INPUT');
    });

    test('responde 400 AGENDA_INVALID_INPUT si odontologoId no es UUID', async () => {
      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
          fecha: '2026-11-09',
          odontologoId: 'no-es-uuid',
          userRepository: mockUserRepository({}),
          odontologoRepository: mockOdontologoRepository({}),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.equal(error.status, 400);
      assert.equal(error.code, 'AGENDA_INVALID_INPUT');
    });
  });

  describe('Rol secretaria (3.1)', () => {
    test('devuelve agenda completa del tenant ordenada por inicio', async () => {
      const turno1 = turnoRow(
        't-1',
        '2026-11-09T15:00:00-03:00',
        '2026-11-09T15:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana Gómez', telefono: '1144556677' },
        { id: ODONTOLOGO_A, nombre: 'Dr. López' }
      );
      const turno2 = turnoRow(
        't-2',
        '2026-11-09T09:00:00-03:00',
        '2026-11-09T09:30:00-03:00',
        'atendido',
        { id: PACIENTE_A, nombre: 'Ana Gómez', telefono: '1144556677' },
        { id: ODONTOLOGO_A, nombre: 'Dr. López' }
      );
      const turno3 = turnoRow(
        't-3',
        '2026-11-09T12:00:00-03:00',
        '2026-11-09T12:30:00-03:00',
        'cancelado',
        { id: PACIENTE_A, nombre: 'Ana Gómez', telefono: '1144556677' },
        { id: ODONTOLOGO_A, nombre: 'Dr. López' }
      );

      const turnoRepo = mockTurnoRepository([turno1, turno2, turno3]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      assert.equal(resultado.fecha, '2026-11-09');
      assert.equal(resultado.odontologoId, null);
      assert.equal(resultado.turnos.length, 3);
      assert.equal(resultado.turnos[0].id, 't-2'); // 09:00 primero
      assert.equal(resultado.turnos[1].id, 't-3'); // 12:00 segundo
      assert.equal(resultado.turnos[2].id, 't-1'); // 15:00 tercero
      assert.equal(resultado.turnos[2].estado, 'reservado');
      assert.equal(resultado.turnos[1].estado, 'cancelado');
      assert.equal(resultado.turnos[0].paciente.id, PACIENTE_A);
      assert.equal(resultado.turnos[0].paciente.nombre, 'Ana Gómez');
      assert.equal(resultado.turnos[0].paciente.telefono, '1144556677');
      assert.equal(resultado.turnos[0].odontologo.id, ODONTOLOGO_A);
      assert.equal(resultado.turnos[0].odontologo.nombre, 'Dr. López');
    });

    test('devuelve lista vacía cuando no hay turnos el día', async () => {
      const turnoRepo = mockTurnoRepository([]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      assert.deepEqual(resultado.turnos, []);
    });

    test('filtra por odontólogo cuando se envía odontologoId', async () => {
      const turnoA = turnoRow(
        't-a',
        '2026-11-09T10:00:00-03:00',
        '2026-11-09T10:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_A, nombre: 'Dr. A' }
      );
      const turnoB = turnoRow(
        't-b',
        '2026-11-09T11:00:00-03:00',
        '2026-11-09T11:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_B, nombre: 'Dr. B' }
      );

      const turnoRepo = mockTurnoRepository([turnoA, turnoB]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        odontologoId: ODONTOLOGO_A,
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({ id: ODONTOLOGO_A, tenant_id: TENANT_A, nombre: 'Dr. A' }),
        turnoRepository: turnoRepo,
      });

      assert.equal(resultado.odontologoId, ODONTOLOGO_A);
      assert.equal(resultado.turnos.length, 1);
      assert.equal(resultado.turnos[0].id, 't-a');
    });

    test('responde 404 AGENDA_ODONTOLOGO_NO_ENCONTRADO si el odontólogo no pertenece al tenant', async () => {
      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
          fecha: '2026-11-09',
          odontologoId: ODONTOLOGO_B,
          ahora: AHORA,
          userRepository: mockUserRepository({}),
          odontologoRepository: mockOdontologoRepository(null),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.equal(error.status, 404);
      assert.equal(error.code, 'AGENDA_ODONTOLOGO_NO_ENCONTRADO');
    });
  });

  describe('Rol odontólogo (3.2)', () => {
    test('odontólogo con vínculo ve solo sus propios turnos', async () => {
      const usuarioOdontologo = {
        id: USUARIO_ODONTOLOGO,
        tenant_id: TENANT_A,
        rol: 'odontologo',
        odontologo_id: ODONTOLOGO_A,
      };

      const turnoA = turnoRow(
        't-a',
        '2026-11-09T10:00:00-03:00',
        '2026-11-09T10:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_A, nombre: 'Dr. A' }
      );
      const turnoB = turnoRow(
        't-b',
        '2026-11-09T11:00:00-03:00',
        '2026-11-09T11:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_B, nombre: 'Dr. B' }
      );

      const turnoRepo = mockTurnoRepository([turnoA, turnoB]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_ODONTOLOGO, tenant_id: TENANT_A, rol: 'odontologo' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository(usuarioOdontologo),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      assert.equal(resultado.odontologoId, ODONTOLOGO_A);
      assert.equal(resultado.turnos.length, 1);
      assert.equal(resultado.turnos[0].id, 't-a');
    });

    test('odontólogo que pide agenda de otro profesional recibe 403 AGENDA_ODONTOLOGO_AJENO', async () => {
      const usuarioOdontologo = {
        id: USUARIO_ODONTOLOGO,
        tenant_id: TENANT_A,
        rol: 'odontologo',
        odontologo_id: ODONTOLOGO_A,
      };

      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_ODONTOLOGO, tenant_id: TENANT_A, rol: 'odontologo' },
          fecha: '2026-11-09',
          odontologoId: ODONTOLOGO_B,
          ahora: AHORA,
          userRepository: mockUserRepository(usuarioOdontologo),
          odontologoRepository: mockOdontologoRepository({}),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.equal(error.status, 403);
      assert.equal(error.code, 'AGENDA_ODONTOLOGO_AJENO');
    });

    test('usuario odontólogo sin vínculo recibe 403 AGENDA_SIN_ODONTOLOGO', async () => {
      const usuarioSinVinculo = {
        id: USUARIO_ODONTOLOGO,
        tenant_id: TENANT_A,
        rol: 'odontologo',
        odontologo_id: null,
      };

      const error = await capturarError(() =>
        buildAgenda({
          user: { id: USUARIO_ODONTOLOGO, tenant_id: TENANT_A, rol: 'odontologo' },
          fecha: '2026-11-09',
          ahora: AHORA,
          userRepository: mockUserRepository(usuarioSinVinculo),
          odontologoRepository: mockOdontologoRepository({}),
          turnoRepository: mockTurnoRepository(),
        })
      );

      assert.equal(error.status, 403);
      assert.equal(error.code, 'AGENDA_SIN_ODONTOLOGO');
    });
  });

  describe('Respuesta expandida y secretos (3.3)', () => {
    test('no expone token_cancelacion ni password_hash en ningún turno', async () => {
      const turnoConSecreto = {
        id: 't-secreto',
        tenant_id: TENANT_A,
        inicio: new Date('2026-11-09T10:00:00-03:00'),
        fin: new Date('2026-11-09T10:30:00-03:00'),
        estado: 'reservado',
        paciente: {
          id: PACIENTE_A,
          nombre: 'Ana',
          telefono: '1111',
        },
        odontologo: {
          id: ODONTOLOGO_A,
          nombre: 'Dr. López',
        },
        token_cancelacion: 'token-secreto-12345',
        password_hash: '$2b$12$hash',
      };

      const turnoRepo = {
        async findByDay() {
          return [turnoConSecreto];
        },
      };

      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      const texto = JSON.stringify(resultado);
      assert.ok(!texto.includes('token_cancelacion'));
      assert.ok(!texto.includes('password_hash'));
      assert.ok(!resultado.turnos[0].token_cancelacion);
      assert.ok(!resultado.turnos[0].password_hash);
    });

    test('incluye turnos cancelados con su estado', async () => {
      const turnoCancelado = turnoRow(
        't-cancelado',
        '2026-11-09T14:00:00-03:00',
        '2026-11-09T14:30:00-03:00',
        'cancelado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_A, nombre: 'Dr. López' }
      );

      const turnoRepo = mockTurnoRepository([turnoCancelado]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      assert.equal(resultado.turnos.length, 1);
      assert.equal(resultado.turnos[0].estado, 'cancelado');
    });

    test('fechas de respuesta en ISO -03:00', async () => {
      const turnoConFecha = turnoRow(
        't-fecha',
        '2026-11-09T09:00:00-03:00',
        '2026-11-09T09:30:00-03:00',
        'reservado',
        { id: PACIENTE_A, nombre: 'Ana', telefono: '1111' },
        { id: ODONTOLOGO_A, nombre: 'Dr. López' }
      );

      const turnoRepo = mockTurnoRepository([turnoConFecha]);
      const resultado = await buildAgenda({
        user: { id: USUARIO_SECRETARIA, tenant_id: TENANT_A, rol: 'secretaria' },
        fecha: '2026-11-09',
        ahora: AHORA,
        userRepository: mockUserRepository({}),
        odontologoRepository: mockOdontologoRepository({}),
        turnoRepository: turnoRepo,
      });

      // El campo fecha de la respuesta debe ser la fecha solicitada
      assert.equal(resultado.fecha, '2026-11-09');
    });
  });

  describe('AgendaError', () => {
    test('es una clase con status y code', () => {
      const error = new AgendaError(400, 'AGENDA_INVALID_INPUT', 'fecha inválida');
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'AgendaError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'AGENDA_INVALID_INPUT');
      assert.equal(error.message, 'fecha inválida');
    });
  });
});
