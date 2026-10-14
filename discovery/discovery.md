# Discovery — Sistema Odontológico Turnos/Agenda

**Fecha**: 2026-10-02
**Fuentes investigadas**: sin fuentes (Q&A pura, sin scraping)

## 1. Problema que resuelve

Los consultorios odontológicos necesitan gestionar turnos y agenda de pacientes sin un sistema dedicado, lo que genera desorden, superposiciones y tiempo perdido en coordinación manual.

## 2. Usuarios / roles

- **Paciente**: reserva un turno sin llamar.
- **Secretaria**: gestiona la agenda, confirma o cancela turnos.
- **Odontólogo**: ve su agenda del día y sus pacientes.

## 3. Casos de uso

1. Como paciente, quiero ver horarios libres para reservar sin tener que llamar.
2. Como secretaria/odontólogo, quiero ver la agenda del día para saber pacientes y horarios.
3. Como paciente/secretaria, quiero cancelar un turno con anticipación para liberar el horario.

## 4. Competidores / soluciones existentes

Sin sistema actual — no hay competidor interno relevado. La competencia es la gestión manual (si existe) o la ausencia total de herramienta.

## 5. Funcionalidades necesarias

- Reserva de turno online.
- Vista de agenda diaria por odontólogo.
- Cancelación de turno con anticipación mínima configurable.

## 6. Funcionalidades opcionales

- Nada por ahora — backlog post-MVP a definir en roadmap/KB.

## 7. Reglas de negocio

- Un odontólogo no puede tener dos turnos superpuestos.
- No se puede cancelar un turno con menos de 24 horas de anticipación (supuesto a confirmar — surgió como “antelación” genérica).

## 8. Integraciones

- Ninguna integración externa obligatoria para la v1.

## 9. Restricciones

- Stack obligatorio: Node + Postgres.
- Contexto académico (UTN Metodología) — presupuesto/plazo acotados.

## 10. Riesgos

- **Supuesto sin probar**: si la disponibilidad no se actualiza seguido, el sistema muestra horarios que en realidad no están libres.
- **Riesgo**: adopción — que los pacientes sigan prefiriendo WhatsApp/teléfono por costumbre (no validado).

## 11. Preguntas abiertas

- ¿Soportar multi-odontólogo desde el día 1 o un solo odontólogo por ahora?
- ¿Hace falta login para el paciente o alcanza con nombre + teléfono por turno?
