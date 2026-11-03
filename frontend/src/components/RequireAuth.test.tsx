import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { AuthProvider, login, logout } from '../auth/store';

describe('guard RequireAuth', () => {
  beforeEach(() => {
    logout();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sin token no renderiza el contenido protegido (redirige a /login)', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Routes>
            <Route
              path="/agenda"
              element={
                <RequireAuth>
                  <div data-testid="contenido-protegido" />
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.queryByTestId('contenido-protegido')).not.toBeInTheDocument();
  });

  it('con token valido renderiza los hijos', () => {
    login('tok-1', { id: 'u-1', tenant_id: 't-1', rol: 'secretaria', email: 's@test.com' });
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/agenda']}>
          <Routes>
            <Route
              path="/agenda"
              element={
                <RequireAuth>
                  <div data-testid="contenido-protegido" />
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument();
  });
});
