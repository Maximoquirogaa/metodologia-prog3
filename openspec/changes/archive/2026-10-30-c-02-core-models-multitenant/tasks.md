# Tasks

## 1. Conexión de Base de Datos y Migración Inicial

- [x] 1.1 Configurar cliente de base de datos PostgreSQL en `backend/app/infrastructure/db.js` con soporte para pool de conexiones vía `DATABASE_URL` y verificar con test unitario de configuración y conectividad.
- [x] 1.2 Crear migración SQL `backend/migrations/001_core_models.sql` con extensión `btree_gist`, tablas `tenants`, `odontologos`, `pacientes` y `turnos`, claves foráneas, índices por tenant y la restricción `turnos_no_overlap` (`EXCLUDE USING gist`), verificando la sintaxis DDL.
- [x] 1.3 Implementar runner de migraciones ejecutable vía `npm run migrate` en `backend/scripts/migrate.js` y verificar que aplique la migración 001 de forma idempotente en PostgreSQL.

## 2. Modelos de Dominio y Resolución de Tenant

- [x] 2.1 Definir entidades y esquemas de validación con Zod para `Tenant`, `Odontologo`, `Paciente` y `Turno` en `backend/app/domain/` asegurando `tenant_id` obligatorio y teléfono requerido en paciente, verificando con tests unitarios de validación.
- [x] 2.2 Implementar middleware/helper `resolveTenant()` en `backend/app/infrastructure/tenant.js` con soporte para header `x-tenant-slug`/`x-tenant-id` y fallback a `TENANT_DEFAULT`, verificando con tests unitarios de resolución.

## 3. Repositorios de Persistencia y Scoping

- [x] 3.1 Implementar repositorios de acceso a datos para `TenantRepository`, `OdontologoRepository`, `PacienteRepository` y `TurnoRepository` en `backend/app/infrastructure/repositories/` con consultas SQL parametrizadas, columnas explícitas (sin `SELECT *`) y scope por `tenant_id`.
- [x] 3.2 Escribir tests de integración de aislamiento multi-tenant y verificar que las operaciones de un tenant no accedan ni modifiquen registros de otro tenant.
- [x] 3.3 Escribir tests de integración para la restricción de exclusión de turnos y verificar que la inserción de dos turnos solapados para el mismo odontólogo sea rechazada a nivel de base de datos mientras que turnos cancelados permitan la reutilización del horario.

## 4. Seed de Datos Demo y Verificación Integral

- [x] 4.1 Implementar script de seed `backend/scripts/seed.js` con datos sintéticos (1 consultorio demo, 1 odontólogo Lun–Vie 9–18, 3 pacientes de prueba) y verificar su ejecución idempotente vía `npm run seed`.
- [x] 4.2 Ejecutar suite completa de tests de backend (`npm test`), validación de linting (`npm run lint`) y verificación de especificaciones con `openspec validate --all`.

## Workflow follow-up

- Correr el gate de verificación `node .agents/skills/change-verification-gate/scripts/verify.mjs --mode fast` para comprobar el change.
- Proceder con `/opsx:apply c-02-core-models-multitenant` para la implementación guiada por Strict TDD.
