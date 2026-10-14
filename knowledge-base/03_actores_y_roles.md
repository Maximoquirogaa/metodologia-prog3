# Actores y Roles

## Actores del sistema
| Actor | Descripción | Cómo interactúa |
|-------|-------------|-----------------|
| Paciente | Persona que reserva | Web pública, sin login en v1 (nombre+teléfono) |
| Secretaria | Gestiona agenda | Web privada con login |
| Odontólogo | Ve agenda y atiende | Web privada con login |

## RBAC — Matriz de permisos
| Rol | Turnos | Agenda | Config |
|-----|--------|--------|--------|
| Paciente | crear propio, cancelar propio | ver disponibilidad | — |
| Secretaria | CRUD todos | ver/gestionar | editar horarios |
| Odontólogo | ver/cancelar | ver propia | ver |

RBAC simple (rol → permisos), no ABAC en v1.

## Rutas públicas
- `/` (home + disponibilidad)
- `/reservar` (crear turno, sin auth)
- `/cancelar/:token` (cancelación por link)
