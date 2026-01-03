'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AVATAR_COLORS } from '@/staff-data';

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
  ml: { entitlement: number; used: number; remaining: number };
  history: LeaveHistoryEntry[];
}

function getAvatarColor(staffId: string): string {
  return AVATAR_COLORS[staffId]?.bg || 'bg-gray-500';
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getLeaveTypeLabel(type: string) {
  switch (type) {
    case 'AL':
      return 'Annual';
    case 'RL':
      return 'Replacement';
    case 'EL':
      return 'Emergency';
    case 'ML':
      return 'Medical';
    default:
      return type;
  }
}

export default function StaffLeaveCard({
  staffId,
  staffName,
  staffRole,
  al,
  rl,
  ml,
  history,
}: StaffLeaveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const alPercentUsed = al.entitlement > 0 ? (al.used / al.entitlement) * 100 : 0;
  const rlPercentUsed = rl.earned > 0 ? (rl.used / rl.earned) * 100 : 0;
  const mlPercentUsed = ml.entitlement > 0 ? (ml.used / ml.entitlement) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Card Content */}
      <div className="p-5">
        {/* Staff Info */}
        <div className="flex items-center space-x-3 mb-6">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(staffId)}`}
          >
            {getInitials(staffName)}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{staffName}</h4>
            <p className="text-sm text-gray-500">{staffRole}</p>
          </div>
        </div>

        {/* Annual Leave */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Annual Leave</span>
            <span className="text-sm">
              <span className="font-semibold text-gray-900">{Math.floor(al.remaining)}</span>
              <span className="text-gray-400 text-xs ml-0.5">LEFT</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gray-300 transition-all duration-300"
              style={{ width: `${Math.min(alPercentUsed, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
            <span>{Math.floor(al.used)} used</span>
            <span>{al.entitlement} total</span>
          </div>
        </div>

        {/* Replacement Leave */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Replacement Leave</span>
            <span className="text-sm">
              <span className="font-semibold text-gray-900">{Math.floor(rl.remaining)}</span>
              <span className="text-gray-400 text-xs ml-0.5">LEFT</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gray-300 transition-all duration-300"
              style={{ width: `${Math.min(rlPercentUsed, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
            <span>{Math.floor(rl.used)} used</span>
            <span>{Math.floor(rl.earned)} earned</span>
          </div>
        </div>

        {/* Medical Leave */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Medical Leave</span>
            <span className="text-sm">
              <span className="font-semibold text-gray-900">{Math.floor(ml.remaining)}</span>
              <span className="text-gray-400 text-xs ml-0.5">LEFT</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gray-300 transition-all duration-300"
              style={{ width: `${Math.min(mlPercentUsed, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
            <span>{Math.floor(ml.used)} used</span>
            <span>{ml.entitlement} total</span>
          </div>
        </div>

        {/* View History Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-sm text-blue-600 hover:text-blue-700 pt-1"
        >
          <span>View History {history.length > 0 && `(${history.length})`}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded History Section */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
            Recent Activity
          </h5>
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.slice(0, 10).map((entry) => {
                const date = parseISO(entry.date);
                return (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-center min-w-[32px]">
                        <div className="text-lg font-semibold text-gray-900 leading-tight">
                          {format(date, 'dd')}
                        </div>
                        <div className="text-xs text-gray-400 uppercase">
                          {format(date, 'MMM')}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-700">
                          {getLeaveTypeLabel(entry.leaveType)} Leave
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {getLeaveTypeLabel(entry.leaveType)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No leave history for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}
