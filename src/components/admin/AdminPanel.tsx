'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CalendarDays, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Calendar from '@/components/Calendar';
import AppHeader, { type TabConfig } from '@/components/AppHeader';
import LeaveOverview from './LeaveOverview';
import StaffManagement from './StaffManagement';
import MobileDrawerMenu, { type Tab } from '@/components/mobile/MobileDrawerMenu';
import MobileSimpleBottomBar from '@/components/mobile/MobileSimpleBottomBar';
import CalendarSkeleton from '@/components/CalendarSkeleton';

const tabs: TabConfig[] = [
  { id: 'timetable', label: 'Timetable', icon: CalendarIcon },
  { id: 'leave', label: 'Leave', icon: CalendarDays },
  { id: 'staff', label: 'Staff', icon: Users },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('timetable');
  // Initialize to null to avoid desktop→mobile flash; skeleton shows until detected
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
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

  // Show skeleton while mobile detection is pending
  if (isMobile === null) {
    return (
      <div className="min-h-screen bg-gray-100">
        <CalendarSkeleton />
      </div>
    );
  }

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
              <div className="min-h-screen bg-gray-100 pb-24">
                {/* Header for Leave tab */}
                <div className="px-4 py-3 bg-white border-b border-gray-200">
                  <h1 className="text-lg font-bold text-gray-900">Leave Overview</h1>
                </div>
                <div className="p-4">
                  <LeaveOverview />
                </div>
                {/* Bottom bar with menu */}
                <MobileSimpleBottomBar onMenuOpen={() => setIsDrawerOpen(true)} />
              </div>
            )}
            {activeTab === 'staff' && (
              <div className="min-h-screen bg-gray-100 pb-24">
                {/* Header for Staff tab */}
                <div className="px-4 py-3 bg-white border-b border-gray-200">
                  <h1 className="text-lg font-bold text-gray-900">Staff Management</h1>
                </div>
                <div className="p-4">
                  <StaffManagement isMobile />
                </div>
                {/* Bottom bar with menu */}
                <MobileSimpleBottomBar onMenuOpen={() => setIsDrawerOpen(true)} />
              </div>
            )}
          </main>
          {/* Drawer Menu - available for all tabs */}
          <MobileDrawerMenu
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            activeTab={activeTab}
            onTabChange={handleMobileTabChange}
            onLogout={handleLogout}
          />
        </>
      ) : (
        /* Desktop Layout */
        <>
          {/* Unified Header with logo, tabs, and logout */}
          <AppHeader
            mode="admin"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as Tab)}
            onLogout={handleLogout}
          />

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
