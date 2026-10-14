# Sistema Odontológico — Base de Conocimiento

Base generada interactiva (kb-creator Mode B) desde Discovery odontológico.

## Índice de Archivos
| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, alcance v1, fuera de alcance |
| [02_descripcion_general.md](02_descripcion_general.md) | Node+PG, monolito multi-tenant, API |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Paciente/Secretaria/Odontólogo, RBAC |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Tenant, turnos, no-overlap |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | RN-TU/MT |
| [06_funcionalidades.md](06_funcionalidades.md) | US-001..004 |
| [07_flujos_principales.md](07_flujos_principales.md) | Reservar, agenda, cancelar |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, dirs, env |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | DD-01..03, SU-01..03 |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | IN-01 + 5 abiertas |

## Quick Start
1. Dominio → 01, 03
2. Datos → 04
3. Reglas → 05
4. Arquitectura → 02, 08
5. Implementar → 07, 06
6. Antes de codificar → 10

## Resumen Ejecutivo
SaaS multi-tenant (arranca 1 consultorio) Node+Postgres para turnos odontológicos: reserva sin login, agenda diaria, cancelación con antelación. Riesgo clave: disponibilidad desactualizada.
