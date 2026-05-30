import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, clearToken } from './api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ user: AuthUser }>('/auth/me').then((res) => {
      if (res.ok && res.data) setUser(res.data.user);
      else clearToken();
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    const res = await api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    if (!res.ok || !res.data) return res.error?.message ?? 'Login failed.';
    setToken(res.data.token);
    setUser(res.data.user);
    return null;
  }

  async function register(email: string, password: string, name: string): Promise<string | null> {
    const res = await api<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
      auth: false,
    });
    if (!res.ok || !res.data) return res.error?.message ?? 'Registration failed.';
    setToken(res.data.token);
    setUser(res.data.user);
    return null;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
