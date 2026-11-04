import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/store';
import { setAuthHandlers } from './api/client';
import Login from './pages/Login';
import Agenda from './pages/Agenda';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';

/**
 * Sincroniza los interceptores 401/403 del cliente HTTP con el enrutador:
 * - 401: limpia el token y redirige a /login
 * - 403: se gestiona en RequireRole (acceso denegado sin exponer datos)
 */
function AuthSync() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    setAuthHandlers({
      on401: () => {
        logout();
        navigate('/login');
      },
      on403: () => {
        // No hay datos que exponer; RequireRole renderiza el mensaje.
      },
    });
  }, [navigate, logout]);

  // Si el token se pierde (p. ej. 401) mientras se está en una ruta protegida,
  // el guard RequireAuth ya redirige. Este efecto es respaldo por si acaso.
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthSync />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/agenda"
          element={
            <RequireAuth>
              <RequireRole roles={['secretaria', 'odontologo']}>
                <Agenda />
              </RequireRole>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
