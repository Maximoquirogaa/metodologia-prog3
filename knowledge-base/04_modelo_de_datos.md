# Modelo de Datos

## Dominios
- Tenants (consultorios), Usuarios internos, Pacientes, Odontólogos, Turnos.

## ERD
Tenant 1—N Odontólogo 1—N Turno N—1 Paciente. Turno pertenece a tenant + odontólogo + paciente + slot horario.

## Entidades
### Tenant
- id (uuid, PK), nombre, slug único
- Índices: slug único

### Odontologo
- id, tenant_id (FK), nombre, especialidad, activo
- Relaciones: Tenant 1—N, Turno 1—N

### Paciente
- id, tenant_id, nombre, teléfono, (user_id nullable v1)
- Constraints: teléfono requerido para reserva sin login

### Turno
- id, tenant_id, odontologo_id, paciente_id, inicio (timestamptz), fin, estado (reservado/cancelado/atendido), token_cancelación
- Constraints: no overlap por odontólogo (exclusion constraint), inicio < fin
- Índices: (tenant_id, odontologo_id, inicio)

## Seed data inicial
- 1 tenant demo, 1 odontólogo, horarios Lun–Vie 9–18, 3 pacientes prueba.
