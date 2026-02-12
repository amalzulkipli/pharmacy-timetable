'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, RefreshCw, Loader2 } from 'lucide-react';
import StaffLeaveCard from './StaffLeaveCard';
import { apiUrl } from '@/lib/api';

interface MaternityPeriod {
  startDate: string;
  endDate: string;
}

interface LeaveBalance {
  staffId: string;
  staffName: string;
  staffRole: string;
  year: number;
  al: {
    entitlement: number;
    used: number;
    remaining: number;
  };
  rl: {
    earned: number;
    used: number;
    remaining: number;
  };
  ml: {
    entitlement: number;
    used: number;
    remaining: number;
  };
  mat?: {
    entitlement: number;
    used: number;
    remaining: number;
    activePeriod?: MaternityPeriod;
  };
}

interface LeaveHistoryEntry {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  leaveType: string;
}

export default function LeaveOverview() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [historyByStaff, setHistoryByStaff] = useState<Record<string, LeaveHistoryEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isRecalculating, setIsRecalculating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch balances and history in parallel
      const [balancesRes, historyRes] = await Promise.all([
        fetch(apiUrl(`/api/leave/balances?year=${selectedYear}`)),
        fetch(apiUrl(`/api/leave/history?year=${selectedYear}`)),
      ]);

      if (!balancesRes.ok) throw new Error('Failed to fetch balances');
      if (!historyRes.ok) throw new Error('Failed to fetch history');

      const balancesData = await balancesRes.json();
      const historyData: LeaveHistoryEntry[] = await historyRes.json();

      setBalances(balancesData);

      // Group history by staffId
      const grouped: Record<string, LeaveHistoryEntry[]> = {};
      historyData.forEach((entry) => {
        if (!grouped[entry.staffId]) {
          grouped[entry.staffId] = [];
        }
        grouped[entry.staffId].push(entry);
      });
      setHistoryByStaff(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecalculateRL = async () => {
    try {
      setIsRecalculating(true);
      const response = await fetch(apiUrl('/api/leave/calculate-rl'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!response.ok) throw new Error('Failed to recalculate RL');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate RL');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading leave data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Staff Leave Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="flex-1 sm:flex-none px-4 py-3 border rounded-lg text-sm text-gray-900 min-h-[48px]"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={handleRecalculateRL}
            disabled={isRecalculating}
            className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 min-h-[48px] min-w-[48px]"
            title="Refresh leave balances and recalculate RL"
          >
            {isRecalculating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            <span className="hidden sm:inline ml-2">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {balances.map((balance) => (
          <StaffLeaveCard
            key={balance.staffId}
            staffId={balance.staffId}
            staffName={balance.staffName}
            staffRole={balance.staffRole}
            al={balance.al}
            rl={balance.rl}
            ml={balance.ml}
            mat={balance.mat}
            history={historyByStaff[balance.staffId] || []}
          />
        ))}
      </div>

      {/* Empty State */}
      {balances.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leave balances found for {selectedYear}. Run migration to initialize.
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 p-3 bg-blue-50 rounded-md">
        <p className="text-xs text-blue-700">
          <strong>AL:</strong> Annual Leave entitlement set per staff member.
          <br />
          <strong>RL:</strong> Replacement Leave earned when public holidays fall on default off days.
          Use &quot;Refresh&quot; to update based on holidays.
          <br />
          <strong>ML:</strong> Medical Leave entitlement set per staff member.
          <br />
          <strong>MAT:</strong> Maternity Leave (98 days). Select from calendar to auto-create leave period.
        </p>
      </div>
    </div>
  );
}
