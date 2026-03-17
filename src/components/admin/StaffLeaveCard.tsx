'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, CalendarOff } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { AVATAR_COLORS } from '@/staff-data';

interface LeaveHistoryEntry {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  leaveType: string;
}

interface MaternityPeriod {
  startDate: string;
  endDate: string;
  status?: string;
}

interface StaffLeaveCardProps {
  staffId: string;
  staffName: string;
  staffRole: string;
  al: { entitlement: number; used: number; remaining: number };
  rl: { earned: number; used: number; remaining: number };
  ml: { entitlement: number; used: number; remaining: number };
  mat?: { entitlement: number; used: number; remaining: number; activePeriod?: MaternityPeriod };
  history: LeaveHistoryEntry[];
  onEndMaternityEarly?: (staffId: string, returnDate: string) => Promise<void>;
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
    case 'MAT':
      return 'Maternity';
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
  mat,
  history,
  onEndMaternityEarly,
}: StaffLeaveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEndEarlyDialog, setShowEndEarlyDialog] = useState(false);
  const [showMatMenu, setShowMatMenu] = useState(false);
  const [endEarlyDate, setEndEarlyDate] = useState<Date | undefined>(undefined);
  const [isEndingEarly, setIsEndingEarly] = useState(false);

  const matMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMatMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (matMenuRef.current && !matMenuRef.current.contains(e.target as Node)) {
        setShowMatMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMatMenu]);

  const handleEndEarly = async () => {
    if (!endEarlyDate || !onEndMaternityEarly) return;
    try {
      setIsEndingEarly(true);
      await onEndMaternityEarly(staffId, format(endEarlyDate, 'yyyy-MM-dd'));
      setShowEndEarlyDialog(false);
      setEndEarlyDate(undefined);
    } catch {
      // Error handled by parent
    } finally {
      setIsEndingEarly(false);
    }
  };

  const alPercentUsed = al.entitlement > 0 ? (al.used / al.entitlement) * 100 : 0;
  const rlPercentUsed = rl.earned > 0 ? (rl.used / rl.earned) * 100 : 0;
  const mlPercentUsed = ml.entitlement > 0 ? (ml.used / ml.entitlement) * 100 : 0;
  const matPercentUsed = mat && mat.entitlement > 0 ? (mat.used / mat.entitlement) * 100 : 0;

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

        {/* Maternity Leave - only show if there's an active/ended period or days used */}
        {mat && (mat.activePeriod || mat.used > 0) && (
          <div className={`mb-5 p-3 rounded-lg border ${mat.activePeriod?.status === 'ended_early' ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${mat.activePeriod?.status === 'ended_early' ? 'text-gray-500' : 'text-blue-700'}`}>Maternity Leave</span>
                {mat.activePeriod?.status === 'ended_early' ? (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold tracking-wide">ENDED EARLY</span>
                ) : mat.activePeriod ? (
                  <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-semibold tracking-wide">ACTIVE</span>
                ) : null}
              </div>
              {/* Kebab menu — only show for active periods */}
              {mat.activePeriod && mat.activePeriod.status !== 'ended_early' && onEndMaternityEarly && (
                <div ref={matMenuRef} className="relative">
                  <button
                    onClick={() => setShowMatMenu(!showMatMenu)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${showMatMenu ? 'bg-blue-200 text-blue-700' : 'text-gray-400 hover:bg-blue-100 hover:text-blue-600'}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMatMenu && (
                    <div className="absolute top-8 right-0 bg-white border border-gray-200 rounded-lg shadow-lg ring-1 ring-black/5 min-w-[200px] z-10 overflow-hidden">
                      <button
                        onClick={() => { setShowMatMenu(false); setShowEndEarlyDialog(true); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-orange-600 hover:bg-orange-50 font-medium text-left"
                      >
                        <CalendarOff className="w-4 h-4" />
                        End Maternity Early
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {mat.activePeriod ? (
              <div className={`text-sm ${mat.activePeriod.status === 'ended_early' ? 'text-gray-400' : 'text-blue-600'}`}>
                {format(parseISO(mat.activePeriod.startDate), 'd MMM yyyy')} → {format(parseISO(mat.activePeriod.endDate), 'd MMM yyyy')}
                {mat.activePeriod.status === 'ended_early' && mat.used > 0 && (
                  <span className="text-xs text-gray-400 ml-1">({Math.floor(mat.used)} days)</span>
                )}
              </div>
            ) : (
              <>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${Math.min(matPercentUsed, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-blue-400 mt-1.5">
                  <span>{Math.floor(mat.used)} used</span>
                  <span>{mat.entitlement} total</span>
                </div>
              </>
            )}

            {/* End Early Confirmation Dialog */}
            {showEndEarlyDialog && mat.activePeriod && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 max-w-[400px] w-full overflow-hidden">
                  <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="text-[15px] font-bold text-slate-900">End Maternity Leave Early</div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">{staffName}</div>
                  </div>
                  <div className="px-6 pt-5 pb-6">
                    <p className="text-[13px] text-slate-500 mb-4 leading-normal">
                      Select the return-to-work date. All maternity entries from this date onward will be removed.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <Calendar
                        mode="single"
                        selected={endEarlyDate}
                        onSelect={setEndEarlyDate}
                        defaultMonth={new Date(mat.activePeriod.startDate)}
                        disabled={(date) => {
                          const start = new Date(mat.activePeriod!.startDate);
                          const end = new Date(mat.activePeriod!.endDate);
                          return date <= start || date > end;
                        }}
                        className="!bg-transparent !p-0 w-full [--cell-size:2.25rem]"
                        modifiersClassNames={{
                          selected: "!bg-orange-600 !text-white !font-bold",
                        }}
                      />
                    </div>
                    {endEarlyDate && mat.activePeriod && (
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-[10px] px-4 py-3 mb-5">
                        <svg className="w-4 h-4 text-orange-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span className="text-[13px] text-orange-800">
                          {differenceInDays(new Date(mat.activePeriod.endDate), endEarlyDate) + 1} days will be removed
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleEndEarly}
                        disabled={!endEarlyDate || isEndingEarly}
                        className="flex-1 px-5 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-[10px] hover:bg-orange-700 disabled:opacity-50 transition-colors"
                      >
                        {isEndingEarly ? 'Ending...' : 'Confirm End Early'}
                      </button>
                      <button
                        onClick={() => { setShowEndEarlyDialog(false); setEndEarlyDate(undefined); }}
                        className="px-4 py-2.5 border border-slate-200 text-slate-500 font-semibold text-sm rounded-[10px] hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View History Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-3 -mx-2 px-2 rounded-lg transition-colors min-h-[48px]"
        >
          <span className="font-medium">View History {history.length > 0 && `(${history.length})`}</span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                  <div key={entry.id} className="flex items-center">
                    <div className="text-center w-12">
                      <div className="text-lg font-semibold text-gray-900 leading-tight">
                        {format(date, 'dd')}
                      </div>
                      <div className="text-xs text-gray-400 uppercase">
                        {format(date, 'MMM')}
                      </div>
                    </div>
                    <div className="flex-1 text-sm text-gray-700 pl-3">
                      {getLeaveTypeLabel(entry.leaveType)} Leave
                    </div>
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
