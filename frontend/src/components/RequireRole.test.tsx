import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireRole } from './RequireRole';
import { AuthProvider, login, logout } from '../auth/store';

type Role = 'secretaria' | 'odontologo';

function renderWithRole(role: Role, allowedRoles: Role[] = ['secretaria', 'odontologo']) {
  login('tok-1', { id: 'u-1', tenant_id: 't-1', rol: role, email: 's@test.com' });
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/agenda']}>
        <Routes>
          <Route
            path="/agenda"
            element={
              <RequireRole roles={allowedRoles}>
                <div data-testid="contenido-rol" />
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('guard RequireRole', () => {
  beforeEach(() => {
    logout();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('secretaria con rol permitido ve el contenido', () => {
    renderWithRole('secretaria', ['secretaria', 'odontologo']);
    expect(screen.getByTestId('contenido-rol')).toBeInTheDocument();
  });

  it('odontologo con rol permitido ve el contenido', () => {
    renderWithRole('odontologo', ['secretaria', 'odontologo']);
    expect(screen.getByTestId('contenido-rol')).toBeInTheDocument();
  });

  it('rol no permitido muestra acceso denegado sin exponer datos', () => {
    renderWithRole('odontologo', ['secretaria']);
    expect(screen.getByTestId('access-denied')).toHaveTextContent('Acceso denegado');
    expect(screen.queryByTestId('contenido-rol')).not.toBeInTheDocument();
  });
});
