import { resolve } from 'node:path';
import { getPool, closePool } from '../app/infrastructure/db.js';
import {
  TenantRepository,
  OdontologoRepository,
  PacienteRepository,
} from '../app/infrastructure/repositories/index.js';

export async function runSeed(db = getPool()) {
  const tenantRepo = new TenantRepository(db);
  const odontologoRepo = new OdontologoRepository(db);
  const pacienteRepo = new PacienteRepository(db);

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

  return {
    tenant,
    odontologo,
    pacientes,
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
      return closePool();
    })
    .catch((err) => {
      console.error('Error durante el seed:', err);
      process.exit(1);
    });
}
