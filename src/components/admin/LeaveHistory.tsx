'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LeaveHistoryEntry {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  leaveType: string;
}

interface StaffOption {
  id: string;
  name: string;
}

export default function LeaveHistory() {
  const [history, setHistory] = useState<LeaveHistoryEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStaff, setSelectedStaff] = useState<string>('all');

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      if (!response.ok) throw new Error('Failed to fetch staff');
      const data = await response.json();
      setStaffList(data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const staffParam = selectedStaff !== 'all' ? `&staffId=${selectedStaff}` : '';
      const response = await fetch(`/api/leave/history?year=${selectedYear}${staffParam}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave history');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedStaff]);

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'AL':
        return 'bg-blue-100 text-blue-700';
      case 'RL':
        return 'bg-purple-100 text-purple-700';
      case 'EL':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading leave history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Leave History</h3>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm text-gray-900"
          >
            <option value="all">All Staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {format(parseISO(entry.date), 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.staffName}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLeaveTypeColor(entry.leaveType)}`}>
                    {entry.leaveType}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leave history found for the selected filters.
        </div>
      )}

      {/* Summary */}
      {history.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <strong>AL:</strong> {history.filter((e) => e.leaveType === 'AL').length} days
            </span>
            <span>
              <strong>RL:</strong> {history.filter((e) => e.leaveType === 'RL').length} days
            </span>
            <span>
              <strong>EL:</strong> {history.filter((e) => e.leaveType === 'EL').length} days
            </span>
            <span className="text-gray-500">
              Total: {history.length} leave entries
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
