# Preguntas Abiertas

## Inconsistencias detectadas
### IN-01 — SaaS multi-tenant vs escala pequeña
**Documento A dice**: system_type SaaS multi-tenant. **Documento B dice**: scale equipo pequeño 1 consultorio. **Impacto**: over-engineering o re-modelado. **Resolución propuesta**: mantener tenant_id pero operar single-tenant inicial.

## Preguntas abiertas (priorizadas)
| Prioridad | Pregunta | Bloquea | Decisor |
|-----------|----------|---------|---------|
| Alta | ¿Multi-odontólogo día 1 o uno solo? | Sprint 1 | PO |
| Alta | ¿Login paciente o nombre+tel? (MVP dijo sin login, pero auth pendiente) | Sprint 1 | PO |
| Alta | ¿Antelación cancelación 24h u otro valor? | Sprint 1 | Dueño |
| Media | ¿Frontend React confirmado? | Sprint 2 | Equipo |
| Baja | ¿Recordatorios/pagos en v2? | Lanzamiento | PO |
