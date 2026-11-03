import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, login, logout } from '../auth/store';
import Agenda, { type Turno } from './Agenda';

const turnosDesordenados: Turno[] = [
  {
    id: 't-3',
    inicio: '2026-11-09T15:00:00-03:00',
    fin: '2026-11-09T15:30:00-03:00',
    estado: 'reservado',
    paciente: { id: 'p-1', nombre: 'Ana Gómez', telefono: '1144556677' },
    odontologo: { id: 'o-1', nombre: 'Dr. López' },
  },
  {
    id: 't-1',
    inicio: '2026-11-09T09:00:00-03:00',
    fin: '2026-11-09T09:30:00-03:00',
    estado: 'reservado',
    paciente: { id: 'p-1', nombre: 'Ana Gómez', telefono: '1144556677' },
    odontologo: { id: 'o-1', nombre: 'Dr. López' },
  },
  {
    id: 't-2',
    inicio: '2026-11-09T12:00:00-03:00',
    fin: '2026-11-09T12:30:00-03:00',
    estado: 'atendido',
    paciente: { id: 'p-2', nombre: 'Luis Pérez', telefono: '2233445566' },
    odontologo: { id: 'o-1', nombre: 'Dr. López' },
  },
];

function mockAgenda(turnos: Turno[], fecha = '2026-11-09', odontologoId: string | null = null) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ fecha, odontologoId, turnos }),
      { status: 200 }
    )
  );
}

describe('página /agenda', () => {
  beforeEach(() => {
    logout();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renderiza turnos ordenados por hora ascendente (09:00, 12:00, 15:00)', async () => {
    mockAgenda(turnosDesordenados);

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('turno-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('turno-list').textContent ?? '';
    const i1 = list.indexOf('09:00');
    const i2 = list.indexOf('12:00');
    const i3 = list.indexOf('15:00');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);

    // Cada turno muestra paciente y odontólogo
    expect(screen.getByTestId('turno-t-1')).toHaveTextContent('Ana Gómez');
    expect(screen.getByTestId('turno-t-1')).toHaveTextContent('1144556677');
    expect(screen.getByTestId('turno-t-1')).toHaveTextContent('Dr. López');
  });

  it('día sin turnos muestra lista vacía con mensaje informativo', async () => {
    mockAgenda([], '2026-11-10');

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('agenda-vacia')).toBeInTheDocument();
    });
  });

  it('la respuesta renderizada no expone token_cancelation ni password_hash', async () => {
    const turnosConSecreto = [...turnosDesordenados] as Turno[];
    (turnosConSecreto[0] as any).token_cancelation = 'tc-secret';
    (turnosConSecreto[0] as any).password_hash = 'ph-secret';

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ fecha: '2026-11-09', odontologoId: null, turnos: turnosConSecreto }),
        { status: 200 }
      )
    );

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('turno-t-1')).toBeInTheDocument();
    });

    const html = document.body.innerHTML;
    expect(html).not.toContain('token_cancelation');
    expect(html).not.toContain('password_hash');
    expect(html).not.toContain('tc-secret');
    expect(html).not.toContain('ph-secret');
  });

  it('secretaria filtra por odontólogo: el request incluye odontologoId y solo se muestran sus turnos', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('odontologoId=o-1')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              fecha: '2026-11-09',
              odontologoId: 'o-1',
              turnos: [turnosDesordenados[0], turnosDesordenados[1]], // t-3 y t-1 (o-1)
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            fecha: '2026-11-09',
            odontologoId: null,
            turnos: turnosDesordenados,
          }),
          { status: 200 }
        )
      );
    });

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('odontologo-filter')).toBeInTheDocument();
    });

    // Setea la fecha a 2026-11-09 (por defecto es hoy)
    fireEvent.change(screen.getByTestId('fecha-input'), {
      target: { value: '2026-11-09' },
    });

    // Espera a que se reconsulte con la nueva fecha
    await waitFor(() => {
      expect(screen.getByTestId('turno-t-2')).toBeInTheDocument();
    });

    // Selecciona al odontólogo o-1
    fireEvent.change(screen.getByTestId('odontologo-filter'), {
      target: { value: 'o-1' },
    });

    // El request incluye odontologoId
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/agenda?fecha=2026-11-09&odontologoId=o-1',
        expect.anything()
      );
    });

    // Solo aparecen turnos de o-1
    expect(screen.getByTestId('turno-t-1')).toBeInTheDocument();
    expect(screen.getByTestId('turno-t-3')).toBeInTheDocument();
    expect(screen.queryByTestId('turno-t-2')).not.toBeInTheDocument();
  });

  it('cancelar turno llama DELETE /api/turnos/:id y lo quita de la lista', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ fecha: '2026-11-09', odontologoId: null, turnos: turnosDesordenados }), { status: 200 })
    );

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('turno-t-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancelar-t-1'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/turnos/t-1', expect.objectContaining({ method: 'DELETE' }));
    });

    expect(screen.queryByTestId('turno-t-1')).not.toBeInTheDocument();
  });

  it('cancelar con menos de 24h devuelve 422 y muestra mensaje de negocio', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ fecha: '2026-11-09', odontologoId: null, turnos: turnosDesordenados }), { status: 200 })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'RN-TU-02', error: 'No se puede cancelar con menos de 24h de antelación' }),
        { status: 422 }
      )
    );

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('turno-t-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancelar-t-1'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-error')).toHaveTextContent(
        'No se puede cancelar con menos de 24h de antelación'
      );
    });
  });

  it('odontólogo recibe 403 del backend y muestra acceso denegado sin exponer datos', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'AGENDA_ODONTOLOGO_AJENO', error: 'Un odontólogo solo puede ver su propia agenda' }),
        { status: 403 }
      )
    );

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'odontologo', email: 'o@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('agenda-error')).toHaveTextContent('Acceso denegado');
    });
    expect(screen.queryByTestId('turno-list')).not.toBeInTheDocument();
  });

  it('el cliente nunca envía tenant_id en la URL; solo usa el JWT del Authorization header', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ fecha: '2026-11-09', odontologoId: null, turnos: [] }), { status: 200 })
    );

    login('tok-1', {
      id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Agenda />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).not.toContain('tenant_id');
    expect(calledUrl).toContain('/api/agenda');

    const headers = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect((headers?.headers as Headers)?.get('Authorization')).toBe('Bearer tok-1');
  });
});
