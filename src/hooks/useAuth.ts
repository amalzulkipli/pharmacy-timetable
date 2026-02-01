'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';

export type AuthMode = 'public' | 'admin';

interface UseAuthReturn {
  authMode: AuthMode;
  isAdmin: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchToPublic: () => void;
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isLoading: boolean;
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'public'>('admin');

  const isAuthenticated = status === 'authenticated' && session?.user;
  const isLoading = status === 'loading';

  // Determine effective auth mode
  const authMode: AuthMode = isAuthenticated && viewMode === 'admin' ? 'admin' : 'public';

  const login = async (password: string): Promise<boolean> => {
    try {
      const result = await signIn('credentials', {
        password,
        redirect: false,
      });

      if (result?.ok) {
        setViewMode('admin');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await signOut({ redirect: false });
    setViewMode('public');
  };

  const switchToPublic = () => {
    setViewMode('public');
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
    isLoading,
  };
}
