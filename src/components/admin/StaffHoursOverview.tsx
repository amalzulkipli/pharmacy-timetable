'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getStaffColors } from '@/staff-data';
import type { WeeklyHourSummary } from '@/types/schedule';

interface StaffRowData {
  staffId: string;
  staffName: string;
  monthly: {
    actual: number;
    target: number;
    percentage: number;
    isOnTrack: boolean;
  };
  weeks: Map<number, { actual: number; target: number; isOnTrack: boolean }>;
}

interface Warning {
  staffName: string;
  week: number;
  actual: number;
  target: number;
}

interface Props {
  weeklyHourSummaries: WeeklyHourSummary[];
  monthlyHourTotals: Record<string, { totalActual: number; totalTarget: number; isUnderTarget: boolean }>;
}

export default function StaffHoursOverview({ weeklyHourSummaries, monthlyHourTotals }: Props) {
  // Transform data into staff rows
  const { staffRows, weekNumbers, warnings } = useMemo(() => {
    // Get unique week numbers (excluding temp staff)
    const weekSet = new Set<number>();
    weeklyHourSummaries
      .filter(s => !s.staffId.startsWith('temp-'))
      .forEach(s => weekSet.add(s.week));
    const weekNumbers = Array.from(weekSet).sort((a, b) => a - b);

    // Extract unique staff from summaries (dynamic - includes new staff like Rina)
    const staffMap = new Map<string, { id: string; name: string; weeklyHours: number }>();
    weeklyHourSummaries
      .filter(s => !s.staffId.startsWith('temp-'))
      .forEach(s => {
        if (!staffMap.has(s.staffId)) {
          staffMap.set(s.staffId, {
            id: s.staffId,
            name: s.staffName,
            weeklyHours: s.targetHours,
          });
        }
      });
    const uniqueStaff = Array.from(staffMap.values());

    // Build staff rows from dynamic staff list
    const staffRows: StaffRowData[] = uniqueStaff.map(staff => {
      const monthlyData = monthlyHourTotals[staff.id] || { totalActual: 0, totalTarget: 0, isUnderTarget: false };
      const percentage = monthlyData.totalTarget > 0
        ? Math.round((monthlyData.totalActual / monthlyData.totalTarget) * 100)
        : 0;

      // Build weeks map
      const weeksMap = new Map<number, { actual: number; target: number; isOnTrack: boolean }>();
      weekNumbers.forEach(weekNum => {
        const weekData = weeklyHourSummaries.find(
          s => s.staffId === staff.id && s.week === weekNum
        );
        weeksMap.set(weekNum, {
          actual: weekData?.actualHours || 0,
          target: weekData?.targetHours || staff.weeklyHours,
          isOnTrack: weekData ? !weekData.isUnderTarget : true,
        });
      });

      return {
        staffId: staff.id,
        staffName: staff.name,
        monthly: {
          actual: monthlyData.totalActual,
          target: monthlyData.totalTarget,
          percentage,
          isOnTrack: !monthlyData.isUnderTarget,
        },
        weeks: weeksMap,
      };
    });

    // Collect warnings
    const warnings: Warning[] = weeklyHourSummaries
      .filter(s => s.isUnderTarget && !s.staffId.startsWith('temp-'))
      .map(s => ({
        staffName: s.staffName,
        week: s.week,
        actual: s.actualHours,
        target: s.targetHours,
      }));

    return { staffRows, weekNumbers, warnings };
  }, [weeklyHourSummaries, monthlyHourTotals]);

  // Map week numbers to display labels (Week 1, Week 2, etc.)
  const weekLabels = useMemo(() => {
    return weekNumbers.map((_, index) => `Week ${index + 1}`);
  }, [weekNumbers]);

  if (staffRows.length === 0) return null;

  return (
    <div className="mt-4 bg-white rounded-lg shadow-md p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Staff Hours Overview</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-gray-600">On Track</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-gray-600">Under Allocation</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Table Header */}
          <div
            className="grid gap-4 pb-3 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider"
            style={{ gridTemplateColumns: `140px 180px repeat(${weekNumbers.length}, 1fr)` }}
          >
            <div>Staff</div>
            <div>Monthly Total</div>
            {weekLabels.map((label, idx) => (
              <div key={idx} className="text-center">{label}</div>
            ))}
          </div>

          {/* Staff Rows */}
          {staffRows.map(staff => (
            <div
              key={staff.staffId}
              className="grid gap-4 py-4 border-b border-gray-100 items-center"
              style={{ gridTemplateColumns: `140px 180px repeat(${weekNumbers.length}, 1fr)` }}
            >
              {/* Staff Name Cell */}
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getStaffColors(staff.staffId).bar}`} />
                <span className="font-medium text-gray-900">{staff.staffName}</span>
              </div>

              {/* Monthly Total Cell */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {staff.monthly.actual}h / {staff.monthly.target}h
                  </span>
                  <span className={`text-xs font-medium ${staff.monthly.isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
                    {staff.monthly.percentage}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getStaffColors(staff.staffId).bar}`}
                    style={{ width: `${Math.min(staff.monthly.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Week Cells */}
              {weekNumbers.map((weekNum) => {
                const weekData = staff.weeks.get(weekNum);
                const isOnTrack = weekData?.isOnTrack ?? true;
                return (
                  <div key={weekNum} className="flex justify-center">
                    <span
                      className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                        isOnTrack
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {weekData?.actual || 0}h / {weekData?.target || 0}h
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Warning Banner */}
      {warnings.length > 0 && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Warning:</strong>{' '}
            {warnings.map((w, idx) => (
              <span key={`${w.staffName}-${w.week}`}>
                {w.staffName} is under allocated hours in Week {weekNumbers.indexOf(w.week) + 1} ({w.actual}h/{w.target}h)
                {idx < warnings.length - 1 ? '; ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
