import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  id: string;
  tenant_id: string;
  rol: 'secretaria' | 'odontologo';
  email: string;
}

let accessToken: string | null = null;
let user: User | null = null;
let listeners: (() => void)[] = [];

/**
 * Guarda el access token en memoria (variable de módulo). Nunca escribe en
 * localStorage ni sessionStorage (regla dura del proyecto).
 */
export function login(token: string, userData: User) {
  accessToken = token;
  user = userData;
  listeners.forEach((fn) => fn());
}

export function logout() {
  accessToken = null;
  user = null;
  listeners.forEach((fn) => fn());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getUser(): User | null {
  return user;
}

export function isAuthenticated(): boolean {
  return accessToken != null;
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

const AuthContext = createContext<{
  login: typeof login;
  logout: typeof logout;
  getAccessToken: typeof getAccessToken;
  getUser: typeof getUser;
  isAuthenticated: typeof isAuthenticated;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, []);
  return (
    <AuthContext.Provider value={{ login, logout, getAccessToken, getUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
