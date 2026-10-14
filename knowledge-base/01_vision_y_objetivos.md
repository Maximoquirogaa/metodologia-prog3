# Visión y Objetivos

## Propósito del sistema
Sistema SaaS multi-tenant para gestión de turnos y agenda de pacientes en consultorios odontológicos. Elimina superposiciones y coordinación manual.

## Objetivos por actor
| Actor | Objetivo principal | Objetivos secundarios |
|-------|--------------------|-----------------------|
| Paciente | Reservar turno sin llamar | Cancelar con anticipación |
| Secretaria | Gestionar agenda diaria | Confirmar/cancelar turnos |
| Odontólogo | Ver agenda del día | Evitar huecos irreales |

## Alcance v1.0
- Reserva de turno online sin login obligatorio.
- Vista de agenda diaria por odontólogo.
- Cancelación con anticipación mínima configurable.
- Multi-tenant a nivel modelo (tenant_id), operando inicialmente 1 consultorio.

## Fuera de alcance
- Pagos online.
- Recordatorios automáticos WhatsApp.
- Integraciones externas.

## Métricas de éxito
- 0 turnos superpuestos.
- Tiempo de reserva < 2 min.
- Agenda del día visible en < 3 clics.
