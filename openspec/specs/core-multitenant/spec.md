# core-multitenant Specification

## Purpose
Define el modelo relacional, las invariantes de aislamiento multi-tenant y la prevención de superposición de turnos para el sistema de agenda odontológica.

## Requirements

### Requirement: Entidades base multi-tenant
The system SHALL persistir las entidades Tenant, Odontólogo, Paciente y Turno asegurando que todo registro de dominio incluya un identificador de tenant válido.

#### Scenario: Creación de registros asociados a un tenant
- **WHEN** se inserta un odontólogo, paciente o turno asociado a un tenant existente
- **THEN** el registro se persiste correctamente manteniendo la integridad referencial con el tenant correspondiente

### Requirement: Aislamiento estricto de datos entre tenants
The system SHALL aislar el acceso a los datos por tenant, garantizando que ninguna consulta o modificación de un tenant retorne o afecte datos pertenecientes a otro.

#### Scenario: Filtrado por tenant_id
- **WHEN** un consultorio consulta su listado de odontólogos, pacientes o turnos
- **THEN** el sistema retorna únicamente los registros cuyo tenant_id coincide con el consultorio solicitante

### Requirement: Prevención de turnos solapados en base de datos
The system SHALL impedir la inserción o actualización de turnos activos cuyo intervalo horario intersecte con otro turno activo del mismo odontólogo en la base de datos.

#### Scenario: Rechazo de turno superpuesto
- **WHEN** se intenta registrar un turno cuyo rango [inicio, fin) coincide total o parcialmente con un turno existente del mismo odontólogo en estado no cancelado
- **THEN** la base de datos rechaza la operación mediante una violación de restricción de exclusión

### Requirement: Turnos cancelados liberan el horario
The system SHALL permitir que un nuevo turno reserve un intervalo horario si el turno previo en ese mismo intervalo se encuentra en estado cancelado.

#### Scenario: Reutilización de slot horario cancelado
- **WHEN** un turno existente es marcado como cancelado y se registra un nuevo turno en ese mismo rango horario
- **THEN** la base de datos permite la inserción exitosa del nuevo turno

### Requirement: Datos obligatorios para registro de pacientes
The system SHALL requerir como mínimo nombre completo y teléfono de contacto para registrar un paciente antes de crear un turno.

#### Scenario: Validación de teléfono obligatorio
- **WHEN** se intenta crear un paciente sin especificar un número de teléfono válido
- **THEN** el sistema rechaza la solicitud indicando la obligatoriedad del campo

### Requirement: Poblado de datos iniciales sintéticos
The system SHALL proveer un mecanismo reproducible para sembrar datos iniciales demo compuestos por un tenant, un odontólogo y tres pacientes sintéticos.

#### Scenario: Ejecución idempotente del seed
- **WHEN** se ejecuta el proceso de seed sobre una base de datos limpia o existente
- **THEN** se crean las entidades de prueba requeridas sin duplicar registros en ejecuciones sucesivas
