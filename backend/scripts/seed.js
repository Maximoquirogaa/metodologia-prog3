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

  // 1. Tenant demo
  const slug = (process.env.TENANT_DEFAULT || 'demo').trim().toLowerCase();
  let tenant = await tenantRepo.findBySlug(slug);
  if (!tenant) {
    tenant = await tenantRepo.create({
      nombre: 'Consultorio Odontológico Demo',
      slug,
    });
  }

  // 2. Odontólogo demo (Lun–Vie 9–18)
  const existingOdontologos = await odontologoRepo.findByTenant(tenant.id);
  let odontologo = existingOdontologos.find(o => o.nombre === 'Dr. Lucas Varela');
  if (!odontologo) {
    odontologo = await odontologoRepo.create({
      tenant_id: tenant.id,
      nombre: 'Dr. Lucas Varela',
      especialidad: 'Odontología General',
      activo: true,
    });
  }

  // 3. Tres pacientes sintéticos de prueba
  const syntheticPatients = [
    { nombre: 'Paciente Demo Uno', telefono: '+5491144440001' },
    { nombre: 'Paciente Demo Dos', telefono: '+5491144440002' },
    { nombre: 'Paciente Demo Tres', telefono: '+5491144440003' },
  ];

  const existingPacientes = await pacienteRepo.findByTenant(tenant.id);
  const pacientes = [];

  for (const item of syntheticPatients) {
    let p = existingPacientes.find(ep => ep.nombre === item.nombre);
    if (!p) {
      p = await pacienteRepo.create({
        tenant_id: tenant.id,
        nombre: item.nombre,
        telefono: item.telefono,
      });
    }
    pacientes.push(p);
  }

  // 4. Usuarios internos demo: la agenda privada (C-05) necesita un usuario
  //    secretaria y un odontólogo vinculado al profesional demo.
  const usuarios = [];
  for (const item of DEMO_USERS) {
    const usuario = await asegurarUsuario({
      userRepo,
      tenant_id: tenant.id,
      email: item.email,
      rol: item.rol,
      odontologo_id: item.vinculaOdontologo ? odontologo.id : null,
    });
    usuarios.push(usuario);
  }

  return {
    tenant,
    odontologo,
    pacientes,
    usuarios,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename || '');
if (isMain) {
  runSeed()
    .then((result) => {
      console.log('Seed ejecutado exitosamente con datos sintéticos:');
      console.log(`- Tenant: ${result.tenant.nombre} (${result.tenant.slug})`);
      console.log(`- Odontólogo: ${result.odontologo.nombre} [${result.odontologo.especialidad}]`);
      console.log(`- Pacientes: ${result.pacientes.length} creados o verificados.`);
      console.log(`- Usuarios internos: ${result.usuarios.map(u => u.email).join(', ')}`);
      console.log(`- Contraseña demo: ${DEMO_PASSWORD} (solo demostración)`);
      return closePool();
    })
    .catch((err) => {
      console.error('Error durante el seed:', err);
      process.exit(1);
    });
}
