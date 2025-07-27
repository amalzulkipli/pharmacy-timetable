'use client';

import { useState, useEffect } from 'react';

export type AuthMode = 'public' | 'admin';

interface UseAuthReturn {
  authMode: AuthMode;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  switchToPublic: () => void;
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Alde1234'; // Fallback for development
const AUTH_STORAGE_KEY = 'pharmacy-auth-mode';

export function useAuth(): UseAuthReturn {
  const [authMode, setAuthMode] = useState<AuthMode>('public');

  // Initialize auth state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === 'admin') {
        setAuthMode('admin');
      }
    }
  }, []);

  // Update sessionStorage when auth mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(AUTH_STORAGE_KEY, authMode);
    }
  }, [authMode]);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setAuthMode('admin');
      return true;
    }
    return false;
  };

  const logout = () => {
    setAuthMode('public');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const switchToPublic = () => {
    setAuthMode('public');
  };

  return {
    authMode,
    isAdmin: authMode === 'admin',
    login,
    logout,
    switchToPublic,
  };
}