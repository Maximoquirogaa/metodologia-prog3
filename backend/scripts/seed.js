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
