import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthUser, ThemePreference } from '../types';
import { authService, LoginCredentials, AuthResponse } from '../services/authService';
import { registerUnauthorizedHandler } from '../services/apiClient';
import { useTheme } from './useTheme';

interface AuthContextValue {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: (updated: AuthUser) => void;
  updateThemeWithSync: (nextTheme: ThemePreference) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const { setTheme } = useTheme();

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  useEffect(() => {
    if (user?.themePreference) {
      setTheme(user.themePreference);
    }
  }, [user?.id, user?.themePreference, setTheme]);

  const login = async (credentials: LoginCredentials) => {
    const res = await authService.login(credentials);
    setUser(res.user);
    if (res.user.themePreference) {
      setTheme(res.user.themePreference);
    }
    return res;
  };

  const refreshUser = (updated: AuthUser) => {
    setUser(updated);
    if (updated.themePreference) {
      setTheme(updated.themePreference);
    }
  };

  const updateThemeWithSync = async (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    if (user) {
      try {
        const updated = await authService.updateThemePreference(user.id, nextTheme);
        if (
          updated &&
          updated.role &&
          (updated.role as any) !== 0 &&
          (updated.role as any) !== '0' &&
          ['PRINCIPAL', 'HOD', 'COE'].includes(updated.role)
        ) {
          setUser(updated);
        } else {
          setUser((prev) => (prev ? { ...prev, themePreference: nextTheme } : null));
        }
      } catch {
        setUser((prev) => (prev ? { ...prev, themePreference: nextTheme } : null));
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, updateThemeWithSync }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
