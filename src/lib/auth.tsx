import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { safeJson } from './api';

interface User {
  id: string;
  username: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('momento-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('momento-token');
  });
  const [loading, setLoading] = useState(true);

  // Verify session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('momento-token');
    if (!storedToken) {
      setLoading(false);
      return;
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid session');
        return safeJson<{ user: User }>(res);
      })
      .then((data) => {
        setUser(data.user);
        setToken(storedToken);
        localStorage.setItem('momento-user', JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('momento-token');
        localStorage.removeItem('momento-user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await safeJson<{ error?: string }>(res).catch(() => null);
      throw new Error(data?.error || 'ログインに失敗しました');
    }
    const data = await safeJson<{ token: string; user: User }>(res);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('momento-token', data.token);
    localStorage.setItem('momento-user', JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    if (!res.ok) {
      const data = await safeJson<{ error?: string }>(res).catch(() => null);
      throw new Error(data?.error || '登録に失敗しました');
    }
    const data = await safeJson<{ token: string; user: User }>(res);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('momento-token', data.token);
    localStorage.setItem('momento-user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(async () => {
    const storedToken = localStorage.getItem('momento-token');
    if (storedToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('momento-token');
    localStorage.removeItem('momento-user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
