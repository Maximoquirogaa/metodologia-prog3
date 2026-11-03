import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, 'El nombre del tenant es obligatorio'),
  slug: z
    .string()
    .trim()
    .min(1, 'El slug del tenant es obligatorio')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const OdontologoSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid('El tenant_id debe ser un UUID válido (RN-MT-01)'),
  nombre: z.string().trim().min(1, 'El nombre del odontólogo es obligatorio'),
  especialidad: z.string().trim().default('Odontología General'),
  activo: z.boolean().default(true),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const PacienteSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid('El tenant_id debe ser un UUID válido (RN-MT-01)'),
  nombre: z.string().trim().min(1, 'El nombre del paciente es obligatorio'),
  telefono: z.string().trim().min(6, 'El teléfono es obligatorio y debe tener al menos 6 dígitos (RN-TU-03)'),
  user_id: z.string().uuid().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const UserRolEnum = z.enum(['secretaria', 'odontologo']);

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid('El tenant_id debe ser un UUID válido (RN-MT-01)'),
  email: z.string().trim().email('El email del usuario no es válido'),
  password_hash: z.string().min(20, 'El password_hash debe ser un hash bcrypt válido'),
  rol: UserRolEnum,
  odontologo_id: z.string().uuid('El odontologo_id debe ser un UUID válido').nullable().optional(),
  created_at: z.date().optional(),
});

/**
 * El email es único dentro de cada tenant, no globalmente: la base refuerza
 * esto con UNIQUE(tenant_id, email). Este helper replica la regla a nivel de
 * dominio para validaciones previas a la persistencia.
 */
export function isEmailUniqueInTenant(existingUsers, { tenant_id, email }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  return !existingUsers.some(
    user =>
      user.tenant_id === tenant_id &&
      String(user.email).trim().toLowerCase() === normalizedEmail
  );
}

export const TurnoEstadoEnum = z.enum(['reservado', 'cancelado', 'atendido']);

export const TurnoSchema = z
  .object({
    id: z.string().uuid().optional(),
    tenant_id: z.string().uuid('El tenant_id debe ser un UUID válido (RN-MT-01)'),
    odontologo_id: z.string().uuid('El odontologo_id debe ser un UUID válido'),
    paciente_id: z.string().uuid('El paciente_id debe ser un UUID válido'),
    inicio: z.coerce.date(),
    fin: z.coerce.date(),
    estado: TurnoEstadoEnum.default('reservado'),
    token_cancelacion: z.string().min(16, 'El token de cancelación debe ser seguro'),
    created_at: z.date().optional(),
    updated_at: z.date().optional(),
  })
  .refine(data => data.inicio < data.fin, {
    message: 'La fecha y hora de inicio debe ser anterior a la de fin (RN-TU-01)',
    path: ['inicio'],
  });
