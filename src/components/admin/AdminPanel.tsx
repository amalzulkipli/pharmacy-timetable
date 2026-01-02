'use client';

import { useState } from 'react';
import { Users, Calendar, Settings } from 'lucide-react';
import StaffManagement from './StaffManagement';
import LeaveOverview from './LeaveOverview';

type Tab = 'leave' | 'staff';

interface AdminPanelProps {
  isAdmin: boolean;
}

export default function AdminPanel({ isAdmin }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('leave');

  if (!isAdmin) {
    return null;
  }

  const tabs = [
    { id: 'leave' as Tab, label: 'Leave Management', icon: Calendar },
    { id: 'staff' as Tab, label: 'Staff Management', icon: Users },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-4" aria-label="Admin tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'leave' && <LeaveOverview />}
        {activeTab === 'staff' && <StaffManagement />}
      </div>
    </div>
  );
}
