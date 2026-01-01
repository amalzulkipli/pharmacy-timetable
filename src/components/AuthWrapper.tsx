'use client';

import React, { useState } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapperContent({ children }: AuthWrapperProps) {
  const { login, showLoginModal, closeLoginModal } = useAuth();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    if (success) {
      closeLoginModal();
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {children}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
          <div className="relative top-16 md:top-20 mx-auto p-4 md:p-5 border w-full max-w-sm shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                Admin Access
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Enter the admin password to access editing features
                </p>
              </div>
              <form onSubmit={handleLogin} className="mt-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                {loginError && (
                  <p className="mt-2 text-sm text-red-600">{loginError}</p>
                )}
                <div className="flex items-center justify-center mt-4 space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      closeLoginModal();
                      setPassword('');
                      setLoginError('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      <AuthWrapperContent>
        {children}
      </AuthWrapperContent>
    </AuthProvider>
  );
}