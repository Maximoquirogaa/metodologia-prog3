# Descripción General
## Stack tecnológico
| Capa | Tecnologías | Versión mínima |
|------|--------------|----------------|
| Backend | Node.js + Express/Fastify | Node 20 |
| BD | Postgres | 15 |
| Frontend | Web app (a definir: React) | — |
| Deploy | Docker + Postgres managed | — |

## Arquitectura general
Monolito modular web (frontend + API REST + Postgres) con tenant_id en todas las tablas de dominio. Se elige monolito por velocidad de entrega UTN, pero con aislamiento multi-tenant para escalar a varios consultorios sin re-modelar. Prioriza escalabilidad a nivel modelo, no infra inicial.

## Integraciones externas
| Servicio | Propósito | Tipo |
|----------|-----------|------|
| Ninguna en v1 | — | — |

## API REST
- `GET /api/disponibilidad?odontologoId&fecha`
- `POST /api/turnos` (crear reserva)
- `DELETE /api/turnos/:id` (cancelar con validación RN)
- `GET /api/agenda?fecha&odontologoId`
