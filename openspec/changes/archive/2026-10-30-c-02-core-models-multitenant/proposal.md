# Proposal

## Why

Los consultorios odontológicos necesitan gestionar turnos y agendas con una base de datos relacional sólida que asegure dos invariantes críticas de negocio: aislamiento estricto de datos entre consultorios (RN-MT-01) y una garantía matemática irrompible contra la superposición de turnos para un mismo profesional (RN-TU-01). Sin este modelo de datos fundacional, los cambios subsiguientes de autenticación, disponibilidad, reserva y agenda no pueden construirse de manera confiable.

## What Changes

- **Esquema de base de datos**: Migración SQL inicial (`001_core_models.sql`) que habilita la extensión `btree_gist` y define las tablas `tenants`, `odontologos`, `pacientes` y `turnos` con sus claves foráneas, índices de búsqueda y restricciones de integridad.
- **Garantía anti-overlap a nivel BD**: Restricción de exclusión (`EXCLUDE USING gist`) en la tabla `turnos` sobre el rango `tstzrange(inicio, fin)` particionado por `odontologo_id` para turnos no cancelados, impidiendo turnos solapados en concurrencia sin depender exclusivamente de locks a nivel de aplicación.
- **Aislamiento multi-tenant obligatorio**: Integración de `tenant_id` en todas las entidades de dominio y creación de la utilidad `resolveTenant()` para scoping consistente de operaciones y queries.
- **Entidades y repositorios de dominio**: Implementación de modelos y repositorios en `backend/app/domain/` y `backend/app/infrastructure/` con consultas SQL explícitas (sin `SELECT *`) y parámetros seguros.
- **Datos de prueba reproducibles (Seed)**: Script de seed idempotente con datos sintéticos de demostración (1 consultorio demo, 1 odontólogo con disponibilidad Lun–Vie 9–18 y 3 pacientes de prueba).
- **Cobertura de tests de dominio**: Pruebas automatizadas que validan el aislamiento entre tenants, la detección/rechazo de turnos superpuestos y la obligatoriedad de datos requeridos para pacientes.

## Capabilities

### New Capabilities
- `core-multitenant`: Modelos base de datos relacionales para clínicas odontológicas, scoping multi-tenant estricto por `tenant_id`, prevención de turnos solapados mediante exclusion constraints en PostgreSQL y seed inicial demo.

### Modified Capabilities
*(Ninguna; `platform-foundation` se mantiene intacta)*

## Impact

- **Backend**: Incorpora la capa de persistencia en `backend/app/infrastructure/` y modelos en `backend/app/domain/`.
- **Base de datos**: Requiere PostgreSQL 15 con soporte de extensión `btree_gist` (disponible en la imagen base de Postgres configurada en C-01).
- **APIs**: Establece los contratos internos y helpers de resolución de contexto tenant para los siguientes changes (C-03 auth y C-04 reserva).
