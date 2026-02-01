'use client';

import { useEffect } from 'react';
import { Calendar as CalendarIcon, CalendarDays, Users, LogOut, Check, Trash2 } from 'lucide-react';

type Tab = 'timetable' | 'leave' | 'staff';

const tabs = [
  { id: 'timetable' as Tab, label: 'Timetable', icon: CalendarIcon },
  { id: 'leave' as Tab, label: 'Leave', icon: CalendarDays },
  { id: 'staff' as Tab, label: 'Staff', icon: Users },
];

interface MobileDrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  // Draft-related props (optional - only passed from Calendar)
  hasDraft?: boolean;
  onDiscardDraft?: () => void;
}

export default function MobileDrawerMenu({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onLogout,
  hasDraft,
  onDiscardDraft,
}: MobileDrawerMenuProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTabSelect = (tab: Tab) => {
    onTabChange(tab);
    onClose();
  };

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  const handleDiscardDraft = () => {
    onClose();
    if (onDiscardDraft) {
      onDiscardDraft();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 text-center">Menu</h3>
        </div>

        {/* Navigation Items */}
        <nav className="p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-left transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 active:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <span className="font-medium text-base">{tab.label}</span>
                </div>
                {isActive && <Check className="h-5 w-5 text-blue-600" />}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200" />

        {/* Discard Draft - only show when there's a draft */}
        {hasDraft && onDiscardDraft && (
          <div className="p-2">
            <button
              onClick={handleDiscardDraft}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-600 active:bg-red-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <span className="font-medium text-base">Discard Draft</span>
            </button>
          </div>
        )}

        {/* Divider before logout */}
        <div className="mx-4 border-t border-gray-200" />

        {/* Logout */}
        <div className="p-2 pb-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-600 active:bg-red-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-red-500" />
            </div>
            <span className="font-medium text-base">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

export type { Tab };
