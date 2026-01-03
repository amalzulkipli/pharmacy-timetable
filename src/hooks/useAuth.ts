'use client';

import { useState, useEffect } from 'react';

export type AuthMode = 'public' | 'admin';

interface UseAuthReturn {
  authMode: AuthMode;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  switchToPublic: () => void;
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Alde1234'; // Fallback for development
const AUTH_STORAGE_KEY = 'pharmacy-auth-mode';
const AUTH_COOKIE_NAME = 'pharmacy-admin-auth';

// Cookie utilities
function setAuthCookie() {
  if (typeof document !== 'undefined') {
    // Set cookie for 24 hours
    document.cookie = `${AUTH_COOKIE_NAME}=true; path=/; max-age=86400; samesite=strict`;
  }
}

function clearAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

export function useAuth(): UseAuthReturn {
  const [authMode, setAuthMode] = useState<AuthMode>('public');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Initialize auth state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === 'admin') {
        setAuthMode('admin');
        setAuthCookie(); // Ensure cookie is set for middleware
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
      setAuthCookie();
      return true;
    }
    return false;
  };

  const logout = () => {
    setAuthMode('public');
    clearAuthCookie();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const switchToPublic = () => {
    setAuthMode('public');
  };

  const openLoginModal = () => setShowLoginModal(true);
  const closeLoginModal = () => setShowLoginModal(false);

  return {
    authMode,
    isAdmin: authMode === 'admin',
    login,
    logout,
    switchToPublic,
    showLoginModal,
    openLoginModal,
    closeLoginModal,
  };
}