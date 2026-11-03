import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/store';
import Login from './Login';
import { login, logout } from '../auth/store';

const routes = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/agenda" element={<div data-testid="agenda" />} />
  </Routes>
);

function renderLogin(initialEntry = '/login') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        {routes}
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('página /login', () => {
  beforeEach(() => {
    logout();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('login exitoso: llama POST /api/auth/login, guarda token en memoria y redirige a /agenda', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'tok-123',
          user: {
            id: 'u-1',
            tenant_id: 't-1',
            rol: 'secretaria',
            email: 's@test.com',
          },
        }),
        { status: 200 }
      )
    );

    renderLogin();

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 's@test.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'clave123' },
    });
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    );

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as Record<string, unknown>).body as string
    );
    expect(body.email).toBe('s@test.com');
    expect(body.password).toBe('clave123');

    await waitFor(() => {
      expect(screen.getByTestId('agenda')).toBeInTheDocument();
    });
  });

  it('credenciales inválidas: muestra error y no redirige', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'AUTH_INVALID_CREDENTIALS',
          error: 'Credenciales inválidas',
        }),
        { status: 401 }
      )
    );

    renderLogin();

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 's@test.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'clave-mal' },
    });
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toHaveTextContent(
        'Credenciales inválidas'
      );
    });
    expect(screen.queryByTestId('agenda')).not.toBeInTheDocument();
  });

  it('si ya hay token en memoria, redirige a /agenda sin mostrar el formulario', () => {
    login('tok-ya-existe', {
      id: 'u-1',
      tenant_id: 't-1',
      rol: 'secretaria',
      email: 's@test.com',
    });

    renderLogin();

    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('agenda')).toBeInTheDocument();
  });
});
