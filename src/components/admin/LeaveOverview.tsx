'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface LeaveBalance {
  staffId: string;
  staffName: string;
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
}

export default function LeaveOverview() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isRecalculating, setIsRecalculating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const fetchBalances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/leave/balances?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch balances');
      const data = await response.json();
      setBalances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave balances');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleRecalculateRL = async () => {
    try {
      setIsRecalculating(true);
      const response = await fetch('/api/leave/calculate-rl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!response.ok) throw new Error('Failed to recalculate RL');
      await fetchBalances();
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
          <span className="ml-2 text-gray-600">Loading leave balances...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Leave Overview</h3>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm text-gray-900"
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
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50"
            title="Recalculate RL based on public holidays"
          >
            {isRecalculating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Recalculate RL
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {balances.map((balance) => {
          const alPercentUsed = balance.al.entitlement > 0 ? (balance.al.used / balance.al.entitlement) * 100 : 0;
          const rlPercentUsed = balance.rl.earned > 0 ? (balance.rl.used / balance.rl.earned) * 100 : 0;

          return (
            <div key={balance.staffId} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{balance.staffName}</h4>
                  <p className="text-xs text-gray-500">{balance.year}</p>
                </div>
              </div>

              {/* Annual Leave */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">Annual Leave (AL)</span>
                  <span className="font-medium text-gray-900">
                    {balance.al.remaining.toFixed(1)} / {balance.al.entitlement} days
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${balance.al.remaining <= 2 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100 - alPercentUsed, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                  <span>Used: {balance.al.used.toFixed(1)}</span>
                  <span className={`flex items-center ${balance.al.remaining <= 2 ? 'text-red-600' : 'text-green-600'}`}>
                    {balance.al.remaining <= 2 ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    {balance.al.remaining.toFixed(1)} remaining
                  </span>
                </div>
              </div>

              {/* Replacement Leave */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">Replacement Leave (RL)</span>
                  <span className="font-medium text-gray-900">
                    {balance.rl.remaining.toFixed(1)} / {balance.rl.earned.toFixed(1)} days
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${balance.rl.remaining <= 0 ? 'bg-gray-400' : 'bg-purple-500'}`}
                    style={{ width: `${balance.rl.earned > 0 ? Math.min(100 - rlPercentUsed, 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                  <span>Earned: {balance.rl.earned.toFixed(1)}</span>
                  <span className="text-purple-600">
                    Used: {balance.rl.used.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {balances.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leave balances found for {selectedYear}. Run migration to initialize.
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <p className="text-xs text-blue-700">
          <strong>AL:</strong> Annual Leave entitlement set per staff member.
          <br />
          <strong>RL:</strong> Replacement Leave earned when public holidays fall on default off days.
          Use &quot;Recalculate RL&quot; to update based on holidays.
        </p>
      </div>
    </div>
  );
}
