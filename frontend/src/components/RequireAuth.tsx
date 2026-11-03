import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/store';

/**
 * Guarda de autenticación. Si no hay token en memoria, redirige a /login
 * conservando la ubicación original para volver tras autenticarse.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated()) {
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }

  return <>{children}</>;
}
