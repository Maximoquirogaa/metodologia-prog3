# Arquitectura Propuesta

## Patrones aplicados
| Patrón | Dónde | Por qué |
|--------|-------|---------|
| Monolito modular | backend | Velocidad UTN |
| Multi-tenant por tenant_id | DB/API | Escalar a N consultorios |
| Exclusion constraint Postgres | turnos | Garantiza no-overlap |

## Estructura de directorios
```
proyecto/
├── backend/
│   └── app/
│       ├── domain/ (turnos, tenants)
│       ├── application/ (casos de uso)
│       └── infrastructure/ (pg, http)
└── frontend/
    └── src/
        ├── features/ (reserva, agenda)
        └── pages/
```

## Seguridad
- Auth: login solo internos (secretaria/odontólogo); paciente sin auth v1 por token cancelación.
- Autorización: RBAC simple.
- Validación: zod/joi en API.
- Secrets: .env, nunca en repo.

## Variables de entorno
| Variable | Descripción | Ejemplo | Sensible |
|----------|-------------|---------|----------|
| DATABASE_URL | PG conexión | postgres://... | Y |
| TENANT_DEFAULT | tenant demo | demo | N |
| CANCEL_MIN_HOURS | antelación | 24 | N |
