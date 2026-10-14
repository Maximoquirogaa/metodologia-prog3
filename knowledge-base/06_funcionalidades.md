# Funcionalidades

## Épica 1: Reserva
### US-001 — Ver disponibilidad
**Como** paciente **Quiero** ver horarios libres **Para** elegir sin llamar
**Criterios**:
- [ ] Filtra por odontólogo y fecha
- [ ] No muestra slots ocupados
**Reglas**: RN-TU-04

### US-002 — Reservar turno
**Como** paciente **Quiero** reservar con nombre+teléfono **Para** asegurar atención
**Criterios**:
- [ ] Crea turno en estado reservado
- [ ] Rechaza overlap (RN-TU-01)
**Reglas**: RN-TU-01, RN-TU-03

## Épica 2: Agenda
### US-003 — Ver agenda del día
**Como** secretaria/odontólogo **Quiero** ver agenda diaria **Para** organizar atención
**Criterios**:
- [ ] Lista por hora con paciente
- [ ] Filtra por odontólogo
### US-004 — Cancelar turno
**Como** paciente/secretaria **Quiero** cancelar con antelación **Para** liberar horario
**Criterios**:
- [ ] Bloquea si <24h (RN-TU-02)
- [ ] Libera slot
**Reglas**: RN-TU-02
