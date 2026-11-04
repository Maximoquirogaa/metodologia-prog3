import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/store';
import { request } from '../api/client';

export interface Turno {
  id: string;
  inicio: string;
  fin: string;
  estado: string;
  paciente: { id: string; nombre: string; telefono: string };
  odontologo: { id: string; nombre: string };
}

export interface AgendaResponse {
  fecha: string;
  odontologoId: string | null;
  turnos: Turno[];
}

type Role = 'secretaria' | 'odontologo';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Página privada de agenda del día.
 * - Consulta GET /api/agenda?fecha (con access token en Bearer).
 * - Filtro opcional por odontólogo (secretaria: todos del tenant; odontólogo: propia).
 * - Acción cancelar por turno → DELETE /api/turnos/:id (mock hasta que C-06 se archive).
 * - Nunca expone token_cancelation ni password_hash (el backend tampoco las envía).
 */
export default function Agenda() {
  const { getUser } = useAuth();
  const user = getUser();

  const [fecha, setFecha] = useState<string>(todayISO());
  const [odontologoId, setOdontologoId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const rol = (user?.rol ?? '') as Role;
  const esOdontologo = rol === 'odontologo';

  const fetchAgenda = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const query = odontologoId
        ? `?fecha=${encodeURIComponent(fecha)}&odontologoId=${encodeURIComponent(odontologoId)}`
        : `?fecha=${encodeURIComponent(fecha)}`;
      const res = await request(`/api/agenda${query}`);
      if (res.ok) {
        const data: AgendaResponse = await res.json();
        setTurnos(data.turnos || []);
      } else if (res.status === 403) {
        setError('Acceso denegado');
      } else if (res.status === 401) {
        setError('Sesión expirada');
      } else {
        setError('Error al cargar la agenda');
      }
    } catch {
      setError('Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  }, [fecha, odontologoId]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const handleCancel = async (id: string) => {
    setCancelError('');
    try {
      const res = await request(`/api/turnos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTurnos((prev) => prev.filter((t) => t.id !== id));
      } else if (res.status === 422) {
        const data = await res.json().catch(() => ({
          error: 'No se pudo cancelar el turno',
        }));
        setCancelError(String(data.error || 'No se pudo cancelar el turno'));
      } else {
        setCancelError('No se pudo cancelar el turno');
      }
    } catch {
      setCancelError('No se pudo cancelar el turno');
    }
  };

  const odontologosDisponibles = Array.from(
    new Map(turnos.map((t) => [t.odontologo.id, t.odontologo])).values()
  );

  if (error) {
    return (
      <div data-testid="agenda-error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div data-testid="agenda-page">
      <h1 data-testid="agenda-title">Agenda del día</h1>
      {user && (
        <p data-testid="agenda-user">{user.email} ({user.rol})</p>
      )}
      <div data-testid="agenda-controls">
        <label htmlFor="fecha-input">Fecha</label>
        <input
          id="fecha-input"
          data-testid="fecha-input"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        {!esOdontologo && odontologosDisponibles.length > 0 && (
          <>
            <label htmlFor="odontologo-filter">Odontólogo</label>
            <select
              id="odontologo-filter"
              data-testid="odontologo-filter"
              value={odontologoId ?? ''}
              onChange={(e) => setOdontologoId(e.target.value || null)}
            >
              <option value="">Todos</option>
              {odontologosDisponibles.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading && <p data-testid="agenda-loading">Cargando...</p>}

      {!loading && turnos.length === 0 && (
        <p data-testid="agenda-vacia">No hay turnos para este día.</p>
      )}

      {!loading && turnos.length > 0 && (
        <ul data-testid="turno-list">
          {turnos
            .slice()
            .sort((a, b) => a.inicio.localeCompare(b.inicio))
            .map((t) => (
              <li key={t.id} data-testid={`turno-${t.id}`}>
                <span data-testid={`turno-hora-${t.id}`}>
                  {t.inicio.slice(11, 16)} - {t.fin.slice(11, 16)}
                </span>
                <br />
                Paciente: {t.paciente.nombre} ({t.paciente.telefono})
                <br />
                Odontólogo: {t.odontologo.nombre}
                <br />
                Estado: {t.estado}
                {t.estado !== 'cancelado' && (
                  <button
                    data-testid={`cancelar-${t.id}`}
                    onClick={() => handleCancel(t.id)}
                  >
                    Cancelar
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
      {cancelError && (
        <span data-testid="cancel-error" role="alert">
          {cancelError}
        </span>
      )}
    </div>
  );
}
