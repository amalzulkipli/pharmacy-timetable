'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { getStaffColors } from '@/staff-data';
import type { WeeklyHourSummary } from '@/types/schedule';

// Group warnings by staff and format as inline summary
function formatWarningsSummary(warnings: Warning[]): string {
  // Group by staff name
  const grouped = new Map<string, { week: number; gap: number }[]>();
  warnings.forEach(w => {
    const existing = grouped.get(w.staffName) || [];
    existing.push({ week: w.week, gap: w.actual - w.target });
    grouped.set(w.staffName, existing);
  });

  // Format each staff's warnings
  const parts: string[] = [];
  grouped.forEach((weeks, staffName) => {
    const weekParts = weeks.map(w => `W${w.week} ${w.gap}h`).join(', ');
    parts.push(`${staffName} (${weekParts})`);
  });

  return parts.join(' · ');
}

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
  status?: 'mat' | 'new' | 'over' | 'under' | 'ok';
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
  const [showWarnings, setShowWarnings] = useState(false);

  const { staffRows, weekNumbers, warnings } = useMemo(() => {
    const weekSet = new Set<number>();
    weeklyHourSummaries
      .filter(s => !s.staffId.startsWith('temp-'))
      .forEach(s => weekSet.add(s.week));
    const weekNumbers = Array.from(weekSet).sort((a, b) => a - b);

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

    const warnings: Warning[] = [];

    const staffRows: StaffRowData[] = uniqueStaff.map(staff => {
      const monthlyData = monthlyHourTotals[staff.id] || { totalActual: 0, totalTarget: 0, isUnderTarget: false };
      const percentage = monthlyData.totalTarget > 0
        ? Math.round((monthlyData.totalActual / monthlyData.totalTarget) * 100)
        : 0;

      const weeksMap = new Map<number, { actual: number; target: number; isOnTrack: boolean }>();
      weekNumbers.forEach((weekNum, idx) => {
        const weekData = weeklyHourSummaries.find(
          s => s.staffId === staff.id && s.week === weekNum
        );
        const isOnTrack = weekData ? !weekData.isUnderTarget : true;
        if (!isOnTrack) {
          warnings.push({
            staffName: staff.name,
            week: idx + 1,
            actual: weekData?.actualHours || 0,
            target: weekData?.targetHours || staff.weeklyHours,
          });
        }
        weeksMap.set(weekNum, {
          actual: weekData?.actualHours || 0,
          target: weekData?.targetHours || staff.weeklyHours,
          isOnTrack,
        });
      });

      let status: StaffRowData['status'] = 'ok';
      if (monthlyData.totalActual === 0 && monthlyData.totalTarget > 0) {
        status = 'mat';
      } else if (percentage > 105) {
        status = 'over';
      } else if (monthlyData.isUnderTarget) {
        status = 'under';
      }

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
        status,
      };
    });

    return { staffRows, weekNumbers, warnings };
  }, [weeklyHourSummaries, monthlyHourTotals]);

  if (staffRows.length === 0) return null;

  return (
    <div className="mt-4 bg-[#fafafa] border border-[#e5e5e5] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#171717] tracking-[-0.01em]">Staff Hours</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-[#f5f5f5] border-b border-[#e5e5e5]">
              <th className="text-left py-2 px-4 font-medium text-[#737373] text-[11px] uppercase tracking-[0.02em]">Name</th>
              <th className="text-right py-2 px-4 font-medium text-[#737373] text-[11px] uppercase tracking-[0.02em]">Monthly</th>
              <th className="text-right py-2 px-4 font-medium text-[#737373] text-[11px] uppercase tracking-[0.02em] w-14">%</th>
              {weekNumbers.map((_, idx) => (
                <th key={idx} className="text-right py-2 px-3 font-medium text-[#737373] text-[11px] uppercase tracking-[0.02em] w-12">
                  W{idx + 1}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium text-[#737373] text-[11px] uppercase tracking-[0.02em] w-16">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {staffRows.map((staff, rowIdx) => {
              const colors = getStaffColors(staff.staffId);

              return (
                <tr
                  key={staff.staffId}
                  className={`border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors ${
                    rowIdx === staffRows.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  {/* Name */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colors.hex || '#a3a3a3' }}
                      />
                      <span className="font-medium text-[#171717]">{staff.staffName}</span>
                    </div>
                  </td>

                  {/* Monthly Total */}
                  <td className="py-2.5 px-4 text-right font-mono text-[12px] tabular-nums text-[#525252]">
                    {staff.monthly.actual} / {staff.monthly.target}
                  </td>

                  {/* Percentage */}
                  <td className={`py-2.5 px-4 text-right font-mono text-[12px] tabular-nums font-medium ${
                    staff.status === 'mat' ? 'text-[#a3a3a3]' :
                    staff.monthly.percentage >= 95 ? 'text-[#171717]' : 'text-[#d97706]'
                  }`}>
                    {staff.monthly.percentage}%
                  </td>

                  {/* Weekly Hours */}
                  {weekNumbers.map((weekNum) => {
                    const weekData = staff.weeks.get(weekNum);
                    const isUnder = weekData && !weekData.isOnTrack;
                    return (
                      <td key={weekNum} className={`py-2.5 px-3 text-right font-mono text-[12px] tabular-nums ${
                        isUnder ? 'text-[#d97706]' : 'text-[#525252]'
                      }`}>
                        {weekData?.actual || 0}
                      </td>
                    );
                  })}

                  {/* Status */}
                  <td className="py-2.5 px-3 text-center">
                    {staff.status === 'mat' && (
                      <span className="text-[10px] font-semibold text-[#ea580c] bg-[#fff7ed] px-1.5 py-0.5 rounded">
                        MAT
                      </span>
                    )}
                    {staff.status === 'over' && (
                      <span className="text-[#059669] text-sm">●</span>
                    )}
                    {staff.status === 'under' && (
                      <span className="text-[#d97706] text-sm">⚠</span>
                    )}
                    {staff.status === 'ok' && (
                      <span className="text-[#059669] text-sm">●</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {warnings.length > 0 && (
        <div className="border-t border-[#e5e5e5]">
          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-[13px] text-[#525252] hover:bg-[#f5f5f5] transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#d97706]" />
              <span>{warnings.length} under target</span>
            </div>
            <div className="flex items-center gap-1 text-[#a3a3a3]">
              {showWarnings ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>

          {showWarnings && (
            <div className="px-4 pb-3 pt-1">
              <div className="text-[12px] text-[#525252]">
                {formatWarningsSummary(warnings)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
