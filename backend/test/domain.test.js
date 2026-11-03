import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TenantSchema,
  OdontologoSchema,
  PacienteSchema,
  TurnoSchema,
} from '../app/domain/models.js';

describe('Domain Models Validation with Zod', () => {
  describe('TenantSchema', () => {
    test('valida un tenant correcto', () => {
      const valid = {
        nombre: 'Clínica Dental San Martín',
        slug: 'san-martin',
      };
      const res = TenantSchema.safeParse(valid);
      assert.ok(res.success);
      assert.equal(res.data.slug, 'san-martin');
    });

    test('falla si falta el nombre o slug', () => {
      assert.ok(!TenantSchema.safeParse({ nombre: '' }).success);
      assert.ok(!TenantSchema.safeParse({ slug: '' }).success);
    });
  });

  describe('OdontologoSchema', () => {
    test('valida un odontólogo con tenant_id obligatorio', () => {
      const valid = {
        tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        nombre: 'Dra. María González',
        especialidad: 'Ortodoncia',
      };
      const res = OdontologoSchema.safeParse(valid);
      assert.ok(res.success);
      assert.equal(res.data.activo, true);
    });

    test('falla si falta tenant_id (RN-MT-01)', () => {
      const res = OdontologoSchema.safeParse({
        nombre: 'Dr. Juan Pérez',
      });
      assert.ok(!res.success);
    });
  });

  describe('PacienteSchema', () => {
    test('valida paciente con nombre y teléfono requeridos', () => {
      const valid = {
        tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        nombre: 'Carlos Tevez',
        telefono: '+5491122334455',
      };
      const res = PacienteSchema.safeParse(valid);
      assert.ok(res.success);
    });

    test('falla si falta teléfono requerido (RN-TU-03)', () => {
      const res = PacienteSchema.safeParse({
        tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        nombre: 'Carlos Tevez',
      });
      assert.ok(!res.success);
    });
  });

  describe('TurnoSchema', () => {
    test('valida un turno con rango horario y tenant_id', () => {
      const valid = {
        tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        odontologo_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        paciente_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        inicio: new Date('2026-11-01T10:00:00Z'),
        fin: new Date('2026-11-01T10:30:00Z'),
        token_cancelacion: '1234567890abcdef1234567890abcdef',
      };
      const res = TurnoSchema.safeParse(valid);
      assert.ok(res.success);
      assert.equal(res.data.estado, 'reservado');
    });

    test('falla si inicio no es anterior a fin', () => {
      const invalid = {
        tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        odontologo_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        paciente_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        inicio: new Date('2026-11-01T11:00:00Z'),
        fin: new Date('2026-11-01T10:00:00Z'),
        token_cancelacion: '1234567890abcdef1234567890abcdef',
      };
      const res = TurnoSchema.safeParse(invalid);
      assert.ok(!res.success);
    });
  });
});
