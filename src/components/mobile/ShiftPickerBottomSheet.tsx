'use client';

import { useEffect } from 'react';
import { Check, X, Clock, Calendar, Stethoscope, Baby } from 'lucide-react';
import { SHIFT_DEFINITIONS, AVATAR_COLORS } from '@/staff-data';
import type { StaffMember } from '@/types/schedule';

interface ShiftPickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember;
  currentValue: string;
  onSelect: (shiftKey: string) => void;
  onMaternitySelect?: () => void;
}

const LEAVE_OPTIONS = [
  { key: 'AL', label: 'Annual Leave', color: 'text-blue-600', hasModal: false },
  { key: 'RL', label: 'Replacement Leave', color: 'text-green-600', hasModal: false },
  { key: 'EL', label: 'Emergency Leave', color: 'text-orange-600', hasModal: false },
  { key: 'ML', label: 'Medical Leave', color: 'text-red-600', hasModal: false },
  { key: 'MAT', label: 'Maternity Leave (98 days)', color: 'text-blue-600', hasModal: true },
];

export default function ShiftPickerBottomSheet({
  isOpen,
  onClose,
  staff,
  currentValue,
  onSelect,
  onMaternitySelect,
}: ShiftPickerBottomSheetProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSelect = (value: string, hasModal?: boolean) => {
    if (hasModal && value === 'MAT' && onMaternitySelect) {
      onClose();
      onMaternitySelect();
      return;
    }
    onSelect(value);
    onClose();
  };

  const avatarColors = AVATAR_COLORS[staff.id] || { bg: 'bg-gray-500', badge: 'bg-gray-100 text-gray-700' };
  const initials = staff.name.charAt(0).toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-out max-h-[80vh] overflow-hidden ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${avatarColors.bg} flex items-center justify-center`}>
              <span className="text-white text-sm font-semibold">{initials}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{staff.name}</h3>
              <p className="text-sm text-gray-500">{staff.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options */}
        <div className="overflow-y-auto max-h-[60vh] pb-safe">
          {/* OFF Option */}
          <div className="p-2">
            <button
              onClick={() => handleSelect('off')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                currentValue === 'off'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-sm font-medium">-</span>
                </div>
                <span className="font-medium">OFF</span>
              </div>
              {currentValue === 'off' && <Check className="h-5 w-5 text-blue-600" />}
            </button>
          </div>

          {/* Shifts Section */}
          <div className="px-2">
            <div className="flex items-center gap-2 px-4 py-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shifts</span>
            </div>
            {Object.entries(SHIFT_DEFINITIONS).map(([key, shift]) => {
              const isSelected = currentValue === key;
              const label = shift.timing
                ? `${shift.type} ${shift.timing.charAt(0).toUpperCase() + shift.timing.slice(1)}`
                : shift.type;

              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                        {shift.workHours}h
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="font-medium">{label}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                </button>
              );
            })}
          </div>

          {/* Leave Section */}
          <div className="px-2 pb-4">
            <div className="flex items-center gap-2 px-4 py-2 mt-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Leave</span>
            </div>
            {LEAVE_OPTIONS.map((leave) => {
              const isSelected = currentValue === leave.key;
              const Icon = leave.key === 'ML' ? Stethoscope : leave.key === 'MAT' ? Baby : Calendar;

              return (
                <button
                  key={leave.key}
                  onClick={() => handleSelect(leave.key, leave.hasModal)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : leave.color}`} />
                    </div>
                    <div className="text-left">
                      <span className="font-medium">{leave.key}</span>
                      <span className="text-sm text-gray-500 ml-2">{leave.label}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
