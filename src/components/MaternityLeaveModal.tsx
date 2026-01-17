'use client';

import { useState, useMemo } from 'react';
import { X, Baby } from 'lucide-react';
import { format, addDays, eachMonthOfInterval } from 'date-fns';
import { AVATAR_COLORS, STAFF_MEMBERS } from '@/staff-data';

interface MaternityLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  initialDate: Date;
  onConfirm: (staffId: string, startDate: Date) => Promise<void>;
}

export default function MaternityLeaveModal({
  isOpen,
  onClose,
  staffId,
  initialDate,
  onConfirm,
}: MaternityLeaveModalProps) {
  const [startDate, setStartDate] = useState<Date>(initialDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staff = STAFF_MEMBERS.find((s) => s.id === staffId);
  const avatarColors = AVATAR_COLORS[staffId] || { bg: 'bg-gray-500' };
  const initials = staff?.name.substring(0, 2).toUpperCase() || '??';

  // Calculate end date (start + 97 days = 98 total days)
  const endDate = useMemo(() => addDays(startDate, 97), [startDate]);

  // Get affected months
  const affectedMonths = useMemo(() => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    return months.map((m) => format(m, 'MMM yyyy'));
  }, [startDate, endDate]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(staffId, startDate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create maternity leave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-100">
            <Baby className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mt-4">
            Maternity Leave
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            98 consecutive days of leave
          </p>
        </div>

        {/* Staff Info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
          <div
            className={`w-10 h-10 rounded-full ${avatarColors.bg} flex items-center justify-center`}
          >
            <span className="text-white text-sm font-semibold">{initials}</span>
          </div>
          <div>
            <div className="font-medium text-gray-900">{staff?.name}</div>
            <div className="text-sm text-gray-500">{staff?.role}</div>
          </div>
        </div>

        {/* Start Date Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={format(startDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const newDate = new Date(e.target.value + 'T00:00:00');
              if (!isNaN(newDate.getTime())) {
                setStartDate(newDate);
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
        </div>

        {/* Calculated End Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            End Date
          </label>
          <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-700 font-medium">
            {format(endDate, 'EEEE, d MMMM yyyy')}
          </div>
        </div>

        {/* Affected Months */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Affected Months
          </label>
          <div className="flex flex-wrap gap-1.5">
            {affectedMonths.map((month) => (
              <span
                key={month}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
              >
                {month}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Draft entries will be created for these months
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
