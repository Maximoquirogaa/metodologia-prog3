import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import { getPool, closePool } from '../app/infrastructure/db.js';
import {
  TenantRepository,
  OdontologoRepository,
  PacienteRepository,
  UserRepository,
} from '../app/infrastructure/repositories/index.js';

// Contraseña de los usuarios demo. Solo para entornos locales/demostración:
// nunca se reutiliza en producción ni reemplaza un alta real de usuarios.
export const DEMO_PASSWORD = 'demo1234';

// Usuarios internos sintéticos para poder probar la agenda (C-05).
const DEMO_USERS = [
  { email: 'secretaria@demo.local', rol: 'secretaria', vinculaOdontologo: false },
  { email: 'odontologo@demo.local', rol: 'odontologo', vinculaOdontologo: true },
];

async function asegurarUsuario({ userRepo, tenant_id, email, rol, odontologo_id }) {
  let user = await userRepo.findByEmailAndTenant(tenant_id, email);
  if (!user) {
    const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    return userRepo.create({ tenant_id, email, password_hash, rol, odontologo_id });
  }

  if (user.odontologo_id !== odontologo_id) {
    user = await userRepo.linkOdontologo(tenant_id, user.id, odontologo_id);
  }
  return user;
}

export async function runSeed(db = getPool()) {
  const tenantRepo = new TenantRepository(db);
  const odontologoRepo = new OdontologoRepository(db);
  const pacienteRepo = new PacienteRepository(db);
  const userRepo = new UserRepository(db);

  // 1. Tenant demo (idempotente por slug)
  let tenant = await tenantRepo.findBySlug('demo');
  if (!tenant) {
    tenant = await tenantRepo.create({ nombre: 'Consultorio Odontológico Demo', slug: 'demo' });
  }

  // 2. Odontólogo demo (idempotente por tenant)
  const odontologos = await odontologoRepo.findByTenant(tenant.id);
  let odontologo = odontologos.find((o) => o.nombre === 'Dr. Lucas Varela');
  if (!odontologo) {
    odontologo = await odontologoRepo.create({
      tenant_id: tenant.id,
      nombre: 'Dr. Lucas Varela',
      especialidad: 'Odontología General',
      activo: true,
    });
  }

  // 3. Pacientes demo (idempotentes por tenant + teléfono)
  const pacientesDemo = [
    { nombre: 'Ana Gómez', telefono: '1144556677' },
    { nombre: 'Carlos Ruiz', telefono: '1155667788' },
    { nombre: 'María Sánchez', telefono: '1166778899' },
  ];
  const pacientesExistentes = await pacienteRepo.findByTenant(tenant.id);
  const pacientes = [];
  for (const p of pacientesDemo) {
    let existente = pacientesExistentes.find((pe) => pe.telefono === p.telefono);
    if (!existente) {
      existente = await pacienteRepo.create({
        tenant_id: tenant.id,
        nombre: p.nombre,
        telefono: p.telefono,
      });
    }
    pacientes.push(existente);
  }

  // 4. Usuarios internos sintéticos (idempotentes por tenant_id + email)
  const odontologoIdVinculo = odontologo.id;
  for (const u of DEMO_USERS) {
    await asegurarUsuario({
      userRepo,
      tenant_id: tenant.id,
      email: u.email,
      rol: u.rol,
      odontologo_id: u.vinculaOdontologo ? odontologoIdVinculo : null,
    });
  }

  return { tenant, odontologo, pacientes };
}
