# Decisiones y Supuestos

## Decisiones documentadas
### DD-01 — Monolito modular Node+Postgres
**Decisión**: monolito con tenant_id. **Contexto**: UTN, entrega rápida, escalabilidad futura. **Alternativas**: microservicios, Firebase. **Justificación**: simple hoy, escala mañana. **Trade-off**: deploy único.

### DD-02 — Paciente sin login v1
**Decisión**: nombre+teléfono + token cancelación. **Contexto**: MVP solo flujo principal. **Trade-off**: menos seguridad, más velocidad.

### DD-03 — RBAC simple
**Decisión**: rol → permisos, sin ABAC. **Contexto**: 3 roles.

## Supuestos inferidos
### SU-01 — 24h antelación
**Supuesto**: 24h (usuario dijo “antelación” genérica). **Riesgo**: si son 2h/48h, cambia UX. **Validar**: confirmar con dueño.
### SU-02 — Multi-tenant desde día 1 a nivel modelo
**Supuesto**: SaaS multi-tenant pero opera 1 consultorio (tensión system_type vs scale). **Riesgo**: over-engineering. **Validar**: confirmar si día 1 es 1 o N consultorios.
### SU-03 — React frontend
**Supuesto**: frontend React (no confirmado, stack solo dijo Node+PG). **Validar**: confirmar.
