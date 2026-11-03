import { useAuth } from '../auth/store';

type Role = 'secretaria' | 'odontologo';

/**
 * Guarda de rol. Renderiza los hijos solo si el usuario autenticado tiene uno
 * de los roles permitidos. Si no, muestra "Acceso denegado" sin exponer datos.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, getUser } = useAuth();

  if (!isAuthenticated()) {
    return null; // RequireAuth se encarga de redirigir a /login
  }

  const user = getUser();
  if (!user || !roles.includes(user.rol)) {
    return <div data-testid="access-denied">Acceso denegado</div>;
  }

  return <>{children}</>;
}
