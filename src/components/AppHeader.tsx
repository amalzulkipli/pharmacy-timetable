'use client';

import { LogIn, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';

export interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AppHeaderProps {
  mode: 'public' | 'admin';
  tabs?: TabConfig[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onLoginClick?: () => void;
  onLogout?: () => void;
  isOnline?: boolean;
}

export default function AppHeader({
  mode,
  tabs,
  activeTab,
  onTabChange,
  onLoginClick,
  onLogout,
  isOnline = true,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo/Title */}
          <div className="flex items-center gap-2">
            <Image
              src="/alde-icon.svg"
              alt="Farmasi Alde"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-lg text-gray-900">Alde ST Timetable</span>
            {!isOnline && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full ml-2">
                Offline
              </span>
            )}
          </div>

          {/* Right: Tabs (admin only) + Auth button */}
          <div className="flex items-center">
            {/* Navigation Tabs - Admin only */}
            {mode === 'admin' && tabs && tabs.length > 0 && (
              <>
                <nav className="flex items-center gap-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange?.(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Separator */}
                <div className="w-px h-5 bg-gray-300 mx-4" />
              </>
            )}

            {/* Auth Button */}
            {mode === 'public' ? (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
