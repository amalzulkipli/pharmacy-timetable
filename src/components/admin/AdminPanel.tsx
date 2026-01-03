'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, CalendarDays, Users, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Calendar from '@/components/Calendar';
import LeaveOverview from './LeaveOverview';
import StaffManagement from './StaffManagement';

type Tab = 'timetable' | 'leave' | 'staff';

const tabs = [
  { id: 'timetable' as Tab, label: 'Timetable', icon: CalendarIcon },
  { id: 'leave' as Tab, label: 'Leave Management', icon: CalendarDays },
  { id: 'staff' as Tab, label: 'Staff Management', icon: Users },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('timetable');
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with logo, tabs, and logout */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo/Title */}
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">Alde ST Timetable</span>
            </div>

            {/* Center: Tabs */}
            <div className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Logout */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main>
        {activeTab === 'timetable' && <Calendar mode="admin" hideTitle />}
        {activeTab === 'leave' && (
          <div className="max-w-screen-2xl mx-auto p-4">
            <LeaveOverview />
          </div>
        )}
        {activeTab === 'staff' && (
          <div className="max-w-screen-2xl mx-auto p-4">
            <StaffManagement />
          </div>
        )}
      </main>
    </div>
  );
}
