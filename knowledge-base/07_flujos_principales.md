# Flujos Principales

## Flujo 1: Reservar turno
**Disparador**: paciente elige horario. **Actor**: paciente.
1. Frontend pide disponibilidad → API → DB
2. Paciente completa nombre+tel → POST /turnos
3. API valida overlap y horario → crea turno
**Errores**: overlap → 422 RN-TU-01; fuera horario → 422 RN-TU-04

## Flujo 2: Ver agenda del día
**Disparador**: secretaria abre agenda. **Actor**: secretaria.
1. GET /agenda?fecha → lista turnos
2. Muestra por odontólogo/hora

## Flujo 3: Cancelar turno
**Disparador**: cancelar. **Actor**: paciente/secretaria.
1. DELETE /turnos/:id
2. Valida antelación 24h → cancela o 422 RN-TU-02
