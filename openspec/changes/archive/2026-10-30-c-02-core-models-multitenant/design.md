# Design

## Context

El proyecto dispone del scaffolding básico establecido en C-01 (monolito modular Node.js, Express y PostgreSQL 15 en Docker Compose). C-02 introduce la primera capa de datos de negocio del sistema, que será consumida directamente por los flujos de autenticación interna (C-03) y reserva pública de turnos (C-04). Las restricciones arquitectónicas imponen:
1. PostgreSQL como motor relacional con estricto aislamiento por `tenant_id` (RN-MT-01).
2. Regla dura del proyecto: consultas explícitas (prohibido `SELECT *`).
3. Regla dura del proyecto: errores de negocio mapeados a códigos de regla (422 con código RN).
4. Prevención de concurrencia a nivel de almacenamiento para superposición de turnos (RN-TU-01).

## Goals / Non-Goals

**Goals:**
- Crear la migración SQL 001 con DDL limpio y declarativo que implemente `tenants`, `odontologos`, `pacientes` y `turnos`.
- Implementar la restricción `EXCLUDE USING gist (odontologo_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado != 'cancelado')` mediante la extensión `btree_gist`.
- Implementar la utilidad `resolveTenant()` para obtener y validar el contexto de tenant en peticiones y servicios.
- Crear entidades y repositorios en `backend/app/domain/` e `infrastructure/` con consultas SQL parametrizadas y columnas explícitas.
- Proveer script de seed reproducible con datos demo sintéticos (1 tenant demo, 1 odontólogo Lun–Vie 9–18, 3 pacientes).
- Validar mediante tests unitarios e integrados el aislamiento multi-tenant, el bloqueo de turnos solapados y las validaciones de paciente.

**Non-Goals:**
- Autenticación de usuarios, hashing de contraseñas y emisión de JWTs (corresponde a C-03).
- Endpoints HTTP públicos de reserva de turnos o consulta de disponibilidad (corresponde a C-04).
- Endpoints de consulta de agenda privada del odontólogo (corresponde a C-05).
- Interfaces web de usuario o componentes frontend (corresponde a C-07 y C-08).

## Decisions

### 1. Migraciones SQL nativas vs ORM pesado
- **Decisión**: Utilizar scripts SQL puros gestionados por un runner liviano sobre el cliente de PostgreSQL (`pg`), en lugar de introducir un ORM complejo en esta fase.
- **Razón**: Permite definición exacta de tipos nativos (`uuid-ossp` o `gen_random_uuid()`, `tstzrange`, `timestamptz`), soporte directo para extensiones como `btree_gist` y cláusulas `EXCLUDE USING gist ... WHERE ...` sin fricciones de abstracción.
- **Alternativas consideradas**:
  - *Prisma*: Soporte parcial o engorroso para exclusion constraints de PostgreSQL con predicados parciales (`WHERE estado != 'cancelado'`).
  - *Knex/Kysely*: Añade capas adicionales sin necesidad inmediata en un esquema inicial conciso.

### 2. Exclusion Constraint con predicado parcial para Turnos
- **Decisión**: La restricción de exclusión en `turnos` se define como:
  ```sql
  CONSTRAINT turnos_no_overlap EXCLUDE USING gist (
    odontologo_id WITH =,
    tstzrange(inicio, fin) WITH &&
  ) WHERE (estado != 'cancelado')
  ```
- **Razón**: Garantiza en el motor de base de datos (incluso bajo condiciones de alta concurrencia) que dos transacciones simultáneas no reserven el mismo horario para el mismo odontólogo. La cláusula `WHERE (estado != 'cancelado')` permite reutilizar slots de turnos cancelados sin necesidad de borrarlos físicamente.
- **Alternativas consideradas**:
  - *Validación únicamente en capa de aplicación*: Suceptible a race conditions entre la lectura del slot y la inserción.
  - *Bifurcación en tablas separadas (histórico vs activos)*: Complica consultas y transacciones innecesariamente.

### 3. Scoping de Tenant y helper `resolveTenant()`
- **Decisión**: Todas las consultas a tablas de dominio reciben obligatoriamente el `tenant_id`. Se crea `resolveTenant(req)` que extrae el identificador desde cabecera HTTP (`x-tenant-slug` o `x-tenant-id`), subdominio o fallback a `TENANT_DEFAULT` configurado en variables de entorno.
- **Razón**: Cumple la regla dura de aislamiento multi-tenant desde la primera línea de código de dominio.

### 4. Consultas con proyección explícita (Cumplimiento regla dura `no-select-star`)
- **Decisión**: Todos los repositorios listan explícitamente las columnas en sus cláusulas `SELECT`.
- **Razón**: Mejora el rendimiento, evita lecturas innecesarias en PostgreSQL y cumple con la regla dura contractual del proyecto.

## Risks / Trade-offs

- **[Riesgo: Disponibilidad de extensión `btree_gist` en PostgreSQL]**
  - *Mitigación*: La imagen oficial de PostgreSQL 15 en Docker incluye la extensión `btree_gist` por defecto. El script de migración ejecuta `CREATE EXTENSION IF NOT EXISTS btree_gist;` al inicio.
- **[Riesgo: Manejo de husos horarios y precisión en `timestamptz`]**
  - *Mitigación*: Todas las columnas de fecha/hora se definen como `TIMESTAMPTZ` y se normalizan en formato ISO-8601 UTC en la capa de entrada/salida de la aplicación.
- **[Riesgo: Formateo de teléfonos de pacientes]**
  - *Mitigación*: Validación con Zod que exige al menos formato numérico/telefónico básico sin requerir proveedores externos de SMS en esta fase.
