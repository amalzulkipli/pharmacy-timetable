'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LeaveHistoryEntry {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  leaveType: string;
}

interface StaffLeaveCardProps {
  staffId: string;
  staffName: string;
  staffRole: string;
  al: { entitlement: number; used: number; remaining: number };
  rl: { earned: number; used: number; remaining: number };
  history: LeaveHistoryEntry[];
}

// Avatar colors based on staff initials
const AVATAR_COLORS: Record<string, string> = {
  FA: 'bg-blue-500',
  SI: 'bg-green-500',
  PA: 'bg-pink-400',
  AM: 'bg-purple-500',
};

function getAvatarColor(name: string): string {
  const initials = name.substring(0, 2).toUpperCase();
  return AVATAR_COLORS[initials] || 'bg-gray-500';
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getLeaveTypeBadge(type: string) {
  switch (type) {
    case 'AL':
      return { label: 'Annual', className: 'bg-blue-100 text-blue-700' };
    case 'RL':
      return { label: 'Replacement', className: 'bg-purple-100 text-purple-700' };
    case 'EL':
      return { label: 'Emergency', className: 'bg-orange-100 text-orange-700' };
    default:
      return { label: type, className: 'bg-gray-100 text-gray-700' };
  }
}

export default function StaffLeaveCard({
  staffName,
  staffRole,
  al,
  rl,
  history,
}: StaffLeaveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const alPercentRemaining = al.entitlement > 0 ? (al.remaining / al.entitlement) * 100 : 0;
  const rlPercentRemaining = rl.earned > 0 ? (rl.remaining / rl.earned) * 100 : 0;

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="p-5">
        {/* Staff Info */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(staffName)}`}
            >
              {getInitials(staffName)}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{staffName}</h4>
              <p className="text-sm text-gray-500">{staffRole}</p>
            </div>
          </div>
        </div>

        {/* Annual Leave */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-600">Annual Leave</span>
            <span className="text-lg font-semibold text-gray-900">
              {Math.floor(al.remaining)} <span className="text-sm font-normal text-gray-500">LEFT</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.max(alPercentRemaining, 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1.5">
            <span>{Math.floor(al.used)} used</span>
            <span>{al.entitlement} total</span>
          </div>
        </div>

        {/* Replacement Leave */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-600">Replacement Leave</span>
            <span className="text-lg font-semibold text-gray-900">
              {Math.floor(rl.remaining)} <span className="text-sm font-normal text-gray-500">LEFT</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-purple-500 transition-all duration-300"
              style={{ width: `${Math.max(rlPercentRemaining, 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1.5">
            <span>{Math.floor(rl.used)} used</span>
            <span>{Math.floor(rl.earned)} earned</span>
          </div>
        </div>

        {/* View History Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-sm text-blue-600 hover:text-blue-700 pt-2"
        >
          <span>View History {history.length > 0 && `(${history.length})`}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded History Section */}
      {isExpanded && (
        <div className="border-t bg-gray-50 px-5 py-4">
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recent Activity
          </h5>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.slice(0, 10).map((entry) => {
                const date = parseISO(entry.date);
                const badge = getLeaveTypeBadge(entry.leaveType);
                return (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-center min-w-[40px]">
                        <div className="text-xs font-medium text-gray-500 uppercase">
                          {format(date, 'MMM')}
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {format(date, 'dd')}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.leaveType === 'AL' ? 'Annual Leave' : entry.leaveType === 'RL' ? 'Replacement Leave' : 'Emergency Leave'}
                        </div>
                        <div className="text-xs text-gray-500">1 day</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No leave history for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}
