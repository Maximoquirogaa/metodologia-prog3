# Reglas de Negocio

## Dominio: Turnos (RN-TU)
- **RN-TU-01**: Un odontólogo no puede tener dos turnos superpuestos — se rechaza la creación.
- **RN-TU-02**: No se puede cancelar con menos de 24h de anticipación (supuesto a confirmar).
- **RN-TU-03**: Todo turno requiere paciente con nombre + teléfono.
- **RN-TU-04**: La disponibilidad solo muestra slots dentro del horario del odontólogo.

## Dominio: Multi-tenant (RN-MT)
- **RN-MT-01**: Todo dato de dominio lleva tenant_id; nunca se cruzan tenants.

## Dominio: Excepciones globales
- Validación de input en API; errores de negocio devuelven 422 con código RN.
