'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useAuthHook, AuthMode } from '../hooks/useAuth';

interface AuthContextType {
  authMode: AuthMode;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  switchToPublic: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authData = useAuthHook();

  return (
    <AuthContext.Provider value={authData}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}