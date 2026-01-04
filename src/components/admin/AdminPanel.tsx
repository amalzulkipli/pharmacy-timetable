'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CalendarDays, Users, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Calendar from '@/components/Calendar';
import LeaveOverview from './LeaveOverview';
import StaffManagement from './StaffManagement';
import MobileDrawerMenu, { type Tab } from '@/components/mobile/MobileDrawerMenu';

const tabs = [
  { id: 'timetable' as Tab, label: 'Timetable', icon: CalendarIcon },
  { id: 'leave' as Tab, label: 'Leave', icon: CalendarDays },
  { id: 'staff' as Tab, label: 'Staff', icon: Users },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('timetable');
  const [isMobile, setIsMobile] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { logout } = useAuth();

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleMobileTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {isMobile ? (
        /* Mobile Layout */
        <>
          <main>
            {activeTab === 'timetable' && (
              <Calendar
                mode="admin"
                hideTitle
                hideMobileLogout
                onMobileTabChange={handleMobileTabChange}
              />
            )}
            {activeTab === 'leave' && (
              <div className="min-h-screen bg-gray-100">
                {/* Header for Leave tab */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
                  <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Menu size={22} />
                  </button>
                  <h1 className="text-lg font-bold text-gray-900">Leave Overview</h1>
                </div>
                <div className="p-4 pb-8">
                  <LeaveOverview />
                </div>
              </div>
            )}
            {activeTab === 'staff' && (
              <div className="min-h-screen bg-gray-100">
                {/* Header for Staff tab */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
                  <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Menu size={22} />
                  </button>
                  <h1 className="text-lg font-bold text-gray-900">Staff Management</h1>
                </div>
                <div className="p-4 pb-8">
                  <StaffManagement isMobile />
                </div>
              </div>
            )}
          </main>
          {/* Drawer for Leave and Staff tabs */}
          {activeTab !== 'timetable' && (
            <MobileDrawerMenu
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              activeTab={activeTab}
              onTabChange={handleMobileTabChange}
              onLogout={handleLogout}
            />
          )}
        </>
      ) : (
        /* Desktop Layout */
        <>
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

                {/* Right: Tabs + Separator + Logout */}
                <div className="flex items-center">
                  {/* Tabs */}
                  <div className="flex items-center gap-1">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
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
                  </div>

                  {/* Vertical Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-4" />

                  {/* Logout Button - Red accent */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
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
        </>
      )}
    </div>
  );
}
