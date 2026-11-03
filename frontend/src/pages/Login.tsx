import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { login, useAuth, type User } from '../auth/store';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Si ya hay sesión activa, ir directamente a la agenda.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/agenda');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
        user?: { id: string; tenant_id: string; rol: string; email: string };
      };

      if (res.ok && data.access_token && data.user) {
        login(data.access_token, data.user as User);
        navigate('/agenda');
      } else if (res.status === 401) {
        setError('Credenciales inválidas');
      } else if (res.status === 429) {
        setError(
          'Demasiados intentos de login. Intentá nuevamente en 60 segundos.'
        );
      } else {
        setError('Error al iniciar sesión');
      }
    } catch {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <h2 data-testid="login-title">Iniciar sesión</h2>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        data-testid="email-input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        data-testid="password-input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <div data-testid="login-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" data-testid="login-button" disabled={loading}>
        Iniciar sesión
      </button>
    </form>
  );
}
