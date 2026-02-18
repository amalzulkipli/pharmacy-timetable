'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateMonthSchedule, getWeeklyHourSummaries, getMonthlyHourTotals, exportToCSV } from '../lib/schedule-generator';
import { STAFF_MEMBERS, SHIFT_DEFINITIONS, RAMADAN_SHIFT_KEYS, getStaffColors } from '../staff-data';
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift } from '../types/schedule';
import { useStaffMembers, type DatabaseStaffMember } from '../hooks/useStaff';
import { format, getISOWeek, differenceInMinutes } from 'date-fns';
import { Download, Edit, Save, X, UserPlus, ChevronLeft, ChevronRight, ChevronDown, User, Clock, Check, Trash2, Copy, ClipboardPaste, MoreVertical, Clipboard } from 'lucide-react';
import AldeIcon from './AldeIcon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useScheduleOverridesDB } from '../hooks/useScheduleDB';
import { apiUrl } from '../lib/api';
import LoginModal from './LoginModal';
import StaffHoursOverview from './admin/StaffHoursOverview';
import AppHeader from './AppHeader';
import MobileDrawerMenu, { type Tab } from './mobile/MobileDrawerMenu';
import ShiftPickerBottomSheet from './mobile/ShiftPickerBottomSheet';
import MobileBottomBar from './mobile/MobileBottomBar';
import MaternityLeaveModal from './MaternityLeaveModal';
import CalendarSkeleton from './CalendarSkeleton';


const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ================================================================================================
// Timeline Bar Helper Functions
// ================================================================================================

// Convert time string "HH:MM" to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Constants for timeline range (09:15 to 21:45 = pharmacy operating hours)
const TIMELINE_START = timeToMinutes('09:15'); // 555 minutes
const TIMELINE_END = timeToMinutes('21:45');   // 1305 minutes
const TIMELINE_DURATION = TIMELINE_END - TIMELINE_START; // 750 minutes

// Calculate bar start position as percentage
function calculateBarStart(startTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  return Math.max(0, ((startMinutes - TIMELINE_START) / TIMELINE_DURATION) * 100);
}

// Calculate bar width as percentage
function calculateBarWidth(startTime: string, endTime: string): number {
  const startMinutes = Math.max(timeToMinutes(startTime), TIMELINE_START);
  const endMinutes = Math.min(timeToMinutes(endTime), TIMELINE_END);
  return Math.max(0, ((endMinutes - startMinutes) / TIMELINE_DURATION) * 100);
}

// Note: Bar colors are now dynamically retrieved via getStaffColors(staffId, colorIndex).bar

// ================================================================================================
// Custom Time Utilities
// ================================================================================================

function isCustomTimeKey(value: string): boolean {
  return value.startsWith('custom_');
}

function parseCustomTimeKey(value: string): { startTime: string; endTime: string; workHours: number } | null {
  if (!isCustomTimeKey(value)) return null;
  const [, startTime, endTime] = value.split('_');
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const workHours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
  return { startTime, endTime, workHours };
}

function makeCustomTimeKey(startTime: string, endTime: string): string {
  return `custom_${startTime}_${endTime}`;
}

// ================================================================================================
// Main Calendar Component
// ================================================================================================

interface CalendarProps {
  mode?: 'public' | 'admin';
  hideTitle?: boolean;
  hideMobileLogout?: boolean;
  onMobileTabChange?: (tab: Tab) => void;
  autoOpenLogin?: boolean;
  loginRedirectTo?: string;
}

export default function Calendar({ mode = 'public', hideTitle = false, hideMobileLogout = false, onMobileTabChange, autoOpenLogin = false, loginRedirectTo = '/admin' }: CalendarProps) {
  // Respect mode prop: if mode is 'public', never show admin features
  const isAdmin = mode === 'admin' ? true : false;
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [schedule, setSchedule] = useState<MonthSchedule | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Record<string, Record<string, string>>>({});
  // Snapshot of editBuffer when entering edit mode (to detect overflow changes)
  const originalEditBufferRef = useRef<Record<string, Record<string, string>>>({});

  // Clipboard state for copied week (copy/paste feature)
  const [copiedWeek, setCopiedWeek] = useState<{
    weekNumber: number;
    data: Record<string, string>;  // Key: "dayOfWeek_staffId", Value: shiftKey
    label: string;                 // e.g., "W1 (Dec 30-)"
  } | null>(null);

  // State for week action popup (copy/paste menu)
  const [weekMenuOpen, setWeekMenuOpen] = useState<{
    weekNumber: number;
    position: { x: number; y: number };
  } | null>(null);

  // Type for override structure
  type OverrideData = Record<string, { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' } | ReplacementShift[]>;

  // Calculate previous and next month for fetching adjacent month overrides
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;

  // Use database-backed hook for overrides (with localStorage fallback)
  const {
    overrides: dbOverrides,
    saveOverrides,
    publishDraft,
    discardDraft,
    hasDraft,
    isLoading: isLoadingOverrides,
    isOnline,
    refetch
  } = useScheduleOverridesDB({
    year: selectedYear,
    month: selectedMonth,
    view: mode === 'admin' ? 'admin' : 'public',
  });

  // Also fetch previous month's overrides for days shown from adjacent month
  const {
    overrides: prevMonthOverrides,
    saveOverrides: savePrevMonth,
  } = useScheduleOverridesDB({
    year: prevYear,
    month: prevMonth,
    view: mode === 'admin' ? 'admin' : 'public',
  });

  // Also fetch next month's overrides for days shown from adjacent month
  const {
    overrides: nextMonthOverrides,
    saveOverrides: saveNextMonth,
  } = useScheduleOverridesDB({
    year: nextYear,
    month: nextMonth,
    view: mode === 'admin' ? 'admin' : 'public',
  });

  // Fetch staff from database (with legacy staff fallback)
  const { staff: dynamicStaff, isLoading: isLoadingStaff } = useStaffMembers();

  // Local state for manual overrides (synced from DB)
  const [manualOverrides, setManualOverrides] = useState<Record<string, OverrideData>>({});
  
  // State for the replacement modal
  const [isReplacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacementContext, setReplacementContext] = useState<{ dayKey: string; staffId: string } | null>(null);

  // State for the maternity leave modal
  const [isMaternityModalOpen, setMaternityModalOpen] = useState(false);
  const [maternityContext, setMaternityContext] = useState<{ dayKey: string; staffId: string } | null>(null);

  // State for the custom time modal
  const [isCustomTimeModalOpen, setCustomTimeModalOpen] = useState(false);
  const [customTimeContext, setCustomTimeContext] = useState<{ dayKey: string; staffId: string } | null>(null);

  // State for the login modal
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);

  // Auto-open login modal when redirected from /login page
  useEffect(() => {
    if (autoOpenLogin) {
      setLoginModalOpen(true);
    }
  }, [autoOpenLogin]);

  // --- Mobile View State ---
  // Initialize to null to avoid desktop→mobile flash; skeleton shows until detected
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // Index within the current month's schedule
  const [pendingPosition, setPendingPosition] = useState<'start' | 'end' | null>(null);
  const [pendingDateToSelect, setPendingDateToSelect] = useState<Date | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle pending navigation and default positioning when month changes
  useEffect(() => {
    if (!schedule) return;
    // Only update if the schedule matches the selected month/year
    const scheduleMonth = schedule.days.find(d => d.isCurrentMonth)?.date;
    if (!scheduleMonth) return;
    if (scheduleMonth.getMonth() + 1 !== selectedMonth || scheduleMonth.getFullYear() !== selectedYear) return;

    // Handle pending date selection (from tapping adjacent month date)
    if (pendingDateToSelect) {
      const dateStr = format(pendingDateToSelect, 'yyyy-MM-dd');
      const index = schedule.days.findIndex(d =>
        format(d.date, 'yyyy-MM-dd') === dateStr
      );
      if (index >= 0) {
        setSelectedDayIndex(index);
      }
      setPendingDateToSelect(null);
      return;
    }

    // Handle pending position (from week navigation crossing boundary)
    if (pendingPosition === 'end') {
      const lastIndex = schedule.days.length - 1;
      setSelectedDayIndex(lastIndex);
      setPendingPosition(null);
      return;
    } else if (pendingPosition === 'start') {
      const firstCurrentMonthIndex = schedule.days.findIndex(d => d.isCurrentMonth);
      setSelectedDayIndex(firstCurrentMonthIndex >= 0 ? firstCurrentMonthIndex : 0);
      setPendingPosition(null);
      return;
    }

    // Default: Jump to today's index on initial load
    const today = new Date();
    const todayIndex = schedule.days.findIndex(d =>
      format(d.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    );
    if (todayIndex >= 0) {
      setSelectedDayIndex(todayIndex);
    } else {
      // If today not in month, go to first day of current month
      const firstCurrentMonthIndex = schedule.days.findIndex(d => d.isCurrentMonth);
      setSelectedDayIndex(firstCurrentMonthIndex >= 0 ? firstCurrentMonthIndex : 0);
    }
  }, [schedule, selectedMonth, selectedYear, pendingPosition, pendingDateToSelect]);

  // --- Navigation Handlers ---
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleToday = () => {
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
  };

  // --- Core Logic ---
  // Sync local state with DB overrides (merge current + adjacent months for days shown in view)
  useEffect(() => {
    const mergedOverrides: Record<string, OverrideData> = {};

    // Add previous month overrides first (for days shown from adjacent month)
    if (prevMonthOverrides) {
      Object.assign(mergedOverrides, prevMonthOverrides);
    }

    // Add next month overrides (for days shown from adjacent month at end of view)
    if (nextMonthOverrides) {
      Object.assign(mergedOverrides, nextMonthOverrides);
    }

    // Add current month overrides (these take precedence if any overlap)
    if (dbOverrides) {
      Object.assign(mergedOverrides, dbOverrides);
    }

    setManualOverrides(mergedOverrides as Record<string, OverrideData>);
  }, [dbOverrides, prevMonthOverrides, nextMonthOverrides]);

  useEffect(() => {
    // Apply overrides to the base schedule
    const applyOverrides = (baseSchedule: MonthSchedule, overrides: Record<string, OverrideData>): MonthSchedule => {
      const updatedDays = baseSchedule.days.map(day => {
        const dayKey = format(day.date, 'yyyy-MM-dd');
        const finalDay = { ...day, staffShifts: { ...day.staffShifts }, replacementShifts: day.replacementShifts ? [...day.replacementShifts] : [] };

        if (!overrides[dayKey]) return day;

        Object.keys(overrides[dayKey]).forEach(staffIdOrAction => {
          if (staffIdOrAction === 'replacements') {
            const replacements = overrides[dayKey][staffIdOrAction];
            if (Array.isArray(replacements)) {
              finalDay.replacementShifts = replacements as ReplacementShift[];
            }
          } else {
            const staffId = staffIdOrAction;
            const override = overrides[dayKey][staffId] as { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' };
            if (override && typeof override === 'object' && !Array.isArray(override)) {
              finalDay.staffShifts[staffId] = {
                ...finalDay.staffShifts[staffId],
                shift: override.shift,
                isLeave: override.isLeave,
                leaveType: override.leaveType,
                isOverride: true,
              };
            }
          }
        });
        return finalDay;
      });
      return { ...baseSchedule, days: updatedDays };
    };

    const baseSchedule = generateMonthSchedule(selectedMonth, selectedYear, dynamicStaff);
    const updatedSchedule = applyOverrides(baseSchedule, manualOverrides);
    setSchedule(updatedSchedule);
  }, [selectedMonth, selectedYear, manualOverrides, dynamicStaff]);

  // Safety: Exit edit mode if user loses admin privileges
  useEffect(() => {
    if (!isAdmin && isEditMode) {
      setIsEditMode(false);
    }
  }, [isAdmin, isEditMode]);

  const handleEnterEditMode = () => {
    if (!schedule) return;
    const buffer: Record<string, Record<string, string>> = {};
    schedule.days.forEach(day => {
      const dayKey = format(day.date, 'yyyy-MM-dd');
      buffer[dayKey] = {};
      // Iterate over all staff in the day's staffShifts (includes dynamic staff)
      Object.keys(day.staffShifts).forEach(staffId => {
        const staffShift = day.staffShifts[staffId];
        if (!staffShift) return;
        const { shift, isLeave, leaveType } = staffShift;
        let key = 'off';
        if (isLeave) {
          key = `leave_${leaveType?.toLowerCase()}`;
        } else if (shift) {
          // FIX: Use content-based comparison instead of reference comparison
          // Compare shift properties to find matching SHIFT_DEFINITIONS key
          const foundKey = Object.keys(SHIFT_DEFINITIONS).find(k => {
            const def = SHIFT_DEFINITIONS[k];
            return def.startTime === shift.startTime &&
                   def.endTime === shift.endTime &&
                   def.workHours === shift.workHours;
          });
          key = foundKey || makeCustomTimeKey(shift.startTime, shift.endTime);
        }
        buffer[dayKey][staffId] = key;
      });
    });
    setEditBuffer(buffer);
    originalEditBufferRef.current = JSON.parse(JSON.stringify(buffer));
    setIsEditMode(true);
  };

  // Cancel edit mode and clear clipboard
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setCopiedWeek(null);
    setWeekMenuOpen(null);
  };

  const handleSaveChanges = async () => {
    const newOverrides = { ...manualOverrides };
    Object.keys(editBuffer).forEach(dayKey => {
      if (!newOverrides[dayKey]) newOverrides[dayKey] = {};
      Object.keys(editBuffer[dayKey]).forEach(staffId => {
        const value = editBuffer[dayKey][staffId];
        if(value === 'add_replacement') return;

        let newShift: ShiftDefinition | null = null;
        let isLeave = false;
        let leaveType: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' | undefined = undefined;

        if (value.startsWith('leave')) {
          isLeave = true;
          leaveType = value.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL' | 'ML' | 'MAT';
        } else if (isCustomTimeKey(value)) {
          const parsed = parseCustomTimeKey(value);
          if (parsed) {
            newShift = { type: 'custom', timing: null, ...parsed };
          }
        } else if (value !== 'off') {
          newShift = SHIFT_DEFINITIONS[value];
        }

        newOverrides[dayKey][staffId] = { shift: newShift, isLeave, leaveType };
      });
    });
    setManualOverrides(newOverrides);

    // Partition overrides by month: current month saved normally,
    // overflow months (prev/next) saved separately so each gets its own DraftMonth
    const currentMonthOverrides: Record<string, OverrideData> = {};
    const prevOverflowChanges: Record<string, OverrideData> = {};
    const nextOverflowChanges: Record<string, OverrideData> = {};

    Object.keys(newOverrides).forEach(dayKey => {
      const [y, m] = dayKey.split('-').map(Number);
      if (y === selectedYear && m === selectedMonth) {
        currentMonthOverrides[dayKey] = newOverrides[dayKey];
      } else if (y === prevYear && m === prevMonth && editBuffer[dayKey]) {
        // Only include overflow days that were visible in the calendar grid
        prevOverflowChanges[dayKey] = newOverrides[dayKey];
      } else if (y === nextYear && m === nextMonth && editBuffer[dayKey]) {
        nextOverflowChanges[dayKey] = newOverrides[dayKey];
      }
    });

    // Save current month
    const result = await saveOverrides(currentMonthOverrides);
    if (!result.success) {
      console.warn('Saved locally, will sync when online:', result.error);
    }

    // Save overflow prev month entries only if user actually changed them
    const changedPrevDays = Object.keys(prevOverflowChanges).filter(dayKey => {
      const orig = originalEditBufferRef.current[dayKey];
      const curr = editBuffer[dayKey];
      if (!orig || !curr) return !!orig !== !!curr; // only changed if one exists but not other
      return JSON.stringify(orig) !== JSON.stringify(curr);
    });
    if (changedPrevDays.length > 0) {
      const merged = { ...prevMonthOverrides };
      changedPrevDays.forEach(dayKey => {
        merged[dayKey] = prevOverflowChanges[dayKey];
      });
      await savePrevMonth(merged);
    }

    // Save overflow next month entries only if user actually changed them
    const changedNextDays = Object.keys(nextOverflowChanges).filter(dayKey => {
      const orig = originalEditBufferRef.current[dayKey];
      const curr = editBuffer[dayKey];
      if (!orig || !curr) return !!orig !== !!curr;
      return JSON.stringify(orig) !== JSON.stringify(curr);
    });
    if (changedNextDays.length > 0) {
      const merged = { ...nextMonthOverrides };
      changedNextDays.forEach(dayKey => {
        merged[dayKey] = nextOverflowChanges[dayKey];
      });
      await saveNextMonth(merged);
    }

    setIsEditMode(false);
  };

  // Publish draft to live
  const handlePublish = async () => {
    if (!confirm('Publish changes?\n\nThis will make all draft changes visible to all staff.')) {
      return;
    }
    const result = await publishDraft();
    if (result.success) {
      await refetch(); // Refresh to show published state
    } else {
      alert('Failed to publish: ' + (result.error || 'Unknown error'));
    }
  };

  // Discard draft and revert to published state
  const handleDiscardDraft = async () => {
    if (!confirm('Discard all unpublished changes?\n\nThis cannot be undone.')) {
      return;
    }
    const result = await discardDraft();
    if (result.success) {
      await refetch(); // Refresh to show published state
    } else {
      alert('Failed to discard: ' + (result.error || 'Unknown error'));
    }
  };

  const handleEditBufferChange = (dayKey: string, staffId: string, value: string) => {
    if (value === 'add_replacement') {
      setReplacementContext({ dayKey, staffId });
      setReplacementModalOpen(true);
      return;
    }
    // Intercept maternity leave selection to show modal
    if (value === 'leave_mat') {
      setMaternityContext({ dayKey, staffId });
      setMaternityModalOpen(true);
      return;
    }
    // Intercept custom time picker selection to show modal
    if (value === 'custom_time_picker') {
      setCustomTimeContext({ dayKey, staffId });
      setCustomTimeModalOpen(true);
      return;
    }
    setEditBuffer(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], [staffId]: value } }));
  };

  // Copy all shifts from a week (by ISO week number)
  const handleCopyWeek = (weekNumber: number) => {
    const weekData: Record<string, string> = {};

    // Collect shifts for all days in this ISO week
    Object.entries(editBuffer).forEach(([dateKey, staffShifts]) => {
      const date = new Date(dateKey);
      if (getISOWeek(date) === weekNumber) {
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
        Object.entries(staffShifts).forEach(([staffId, shiftKey]) => {
          weekData[`${dayOfWeek}_${staffId}`] = shiftKey;
        });
      }
    });

    // Get first day of week for label
    const firstDay = Object.keys(editBuffer).find(
      dk => getISOWeek(new Date(dk)) === weekNumber
    );
    const label = firstDay
      ? `W${weekNumber} (${format(new Date(firstDay), 'MMM d')}-)`
      : `W${weekNumber}`;

    setCopiedWeek({ weekNumber, data: weekData, label });
    setWeekMenuOpen(null); // Close popup after copying
  };

  // Paste copied week to target week (by ISO week number)
  const handlePasteWeek = (targetWeekNumber: number) => {
    if (!copiedWeek) return;

    setEditBuffer(prev => {
      const newBuffer = { ...prev };

      Object.keys(newBuffer).forEach(dateKey => {
        const date = new Date(dateKey);
        if (getISOWeek(date) === targetWeekNumber) {
          const dayOfWeek = date.getDay();

          // Use dynamicStaff for paste operation
          dynamicStaff.forEach(staff => {
            const key = `${dayOfWeek}_${staff.id}`;
            if (copiedWeek.data[key]) {
              newBuffer[dateKey] = {
                ...newBuffer[dateKey],
                [staff.id]: copiedWeek.data[key]
              };
            }
          });
        }
      });

      return newBuffer;
    });

    setWeekMenuOpen(null); // Close popup after pasting
  };

  // Handle clicking the kebab menu on Sunday
  const handleWeekMenuClick = (e: React.MouseEvent, weekNumber: number) => {
    e.stopPropagation(); // Prevent triggering other click handlers
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setWeekMenuOpen({
      weekNumber,
      position: {
        x: rect.left - 160, // Position popup to the left of the button
        y: rect.bottom + 4, // Position below the button
      }
    });
  };

  const handleSaveReplacement = async (name: string, start: string, end: string, breakHours: string) => {
    if (!replacementContext || !name) return;

    const { dayKey, staffId } = replacementContext;

    const newOverrides = { ...manualOverrides };
    if (!newOverrides[dayKey]) newOverrides[dayKey] = {};

    // Set original staff to off
    newOverrides[dayKey][staffId] = { shift: null, isLeave: false };

    // Add replacement shift
    const existingReplacements = newOverrides[dayKey].replacements;
    const replacements: ReplacementShift[] = Array.isArray(existingReplacements) ? [...existingReplacements] : [];

    const startDate = new Date(`${dayKey}T${start}`);
    const endDate = new Date(`${dayKey}T${end}`);
    const shiftDuration = differenceInMinutes(endDate, startDate) / 60; // Duration in hours
    const finalWorkHours = shiftDuration - parseFloat(breakHours); // Subtract break time

    replacements.push({
      id: `rep-${Date.now()}`,
      originalStaffId: staffId,
      tempStaffName: name,
      startTime: start,
      endTime: end,
      workHours: finalWorkHours > 0 ? finalWorkHours : 0,
    });

    newOverrides[dayKey].replacements = replacements;

    setManualOverrides(newOverrides);
    // Save overrides to database (with localStorage fallback)
    const result = await saveOverrides(newOverrides);
    if (!result.success) {
      console.warn('Saved locally, will sync when online:', result.error);
    }
    setReplacementModalOpen(false);
    setReplacementContext(null);
    // Reset dropdown in buffer
    handleEditBufferChange(dayKey, staffId, 'off');
  };

  // Handle maternity leave confirmation
  const handleMaternityLeaveConfirm = async (staffId: string, startDate: Date) => {
    try {
      const response = await fetch(apiUrl('/api/leave/maternity'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, startDate: startDate.toISOString() }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server error. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create maternity leave');
      }

      // Exit edit mode first to prevent editBuffer from overwriting MAT entries
      setIsEditMode(false);
      setEditBuffer({});

      // Refresh the calendar to show the new leave entries
      await refetch();
      setMaternityModalOpen(false);
      setMaternityContext(null);
    } catch (error) {
      console.error('Error creating maternity leave:', error);
      throw error;
    }
  };

  const handleDownloadCSV = () => {
    if (!schedule) return;
    const csvContent = exportToCSV(schedule);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pharmacy-schedule-${MONTHS[selectedMonth - 1]}-${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // --- Memoized Calculations for Performance ---
  const weeklyHourSummaries = useMemo(() => schedule ? getWeeklyHourSummaries(schedule, dynamicStaff) : [], [schedule, dynamicStaff]);
  const monthlyHourTotals = useMemo(() => schedule ? getMonthlyHourTotals(schedule, dynamicStaff) : {}, [schedule, dynamicStaff]);

  // Mobile: Get current week number for display
  const currentWeekNumber = useMemo(() => {
    if (!schedule || !schedule.days[selectedDayIndex]) return 1;
    return getISOWeek(schedule.days[selectedDayIndex].date);
  }, [schedule, selectedDayIndex]);

  // Mobile: Navigate to previous/next week (crosses month boundaries)
  const handlePrevWeek = () => {
    const newIndex = selectedDayIndex - 7;
    if (newIndex < 0) {
      // Cross to previous month
      handlePrevMonth();
      setPendingPosition('end');
    } else {
      setSelectedDayIndex(newIndex);
    }
  };

  const handleNextWeek = () => {
    if (!schedule) return;
    const newIndex = selectedDayIndex + 7;
    if (newIndex >= schedule.days.length) {
      // Cross to next month
      handleNextMonth();
      setPendingPosition('start');
    } else {
      setSelectedDayIndex(newIndex);
    }
  };

  // Mobile: Go to today
  const handleGoToToday = () => {
    if (!schedule) return;
    const today = new Date();
    const todayIndex = schedule.days.findIndex(d =>
      format(d.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    );
    if (todayIndex >= 0) {
      setSelectedDayIndex(todayIndex);
    } else {
      // If today not in current month, change to current month
      handleToday();
    }
  };

  // Show skeleton while loading data OR while mobile detection is pending
  if (!schedule || isLoadingOverrides || isLoadingStaff || isMobile === null) {
    return <CalendarSkeleton />;
  }

  // Mobile: Render single-day view
  if (isMobile) {
    return (
      <>
        <MobileView
          schedule={schedule}
          staffMembers={dynamicStaff}
          selectedDayIndex={selectedDayIndex}
          setSelectedDayIndex={setSelectedDayIndex}
          currentWeekNumber={currentWeekNumber}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          setPendingDateToSelect={setPendingDateToSelect}
          isAdmin={isAdmin}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onGoToToday={handleGoToToday}
          mode={mode}
          onLoginClick={() => setLoginModalOpen(true)}
          hideMobileLogout={hideMobileLogout}
          isEditMode={isEditMode}
          editBuffer={editBuffer}
          hasDraft={hasDraft}
          onEnterEditMode={handleEnterEditMode}
          onCancelEdit={handleCancelEdit}
          onSaveChanges={handleSaveChanges}
          onPublish={handlePublish}
          onDiscardDraft={handleDiscardDraft}
          onEditBufferChange={handleEditBufferChange}
          onMobileTabChange={onMobileTabChange}
          onOpenMaternityModal={(dayKey, staffId) => {
            setMaternityContext({ dayKey, staffId });
            setMaternityModalOpen(true);
          }}
        />
        {/* Login Modal for mobile */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          redirectTo={loginRedirectTo}
        />
        {/* Maternity Leave Modal for mobile */}
        {maternityContext && (
          <MaternityLeaveModal
            isOpen={isMaternityModalOpen}
            onClose={() => {
              setMaternityModalOpen(false);
              setMaternityContext(null);
            }}
            staffId={maternityContext.staffId}
            initialDate={new Date(maternityContext.dayKey)}
            onConfirm={handleMaternityLeaveConfirm}
          />
        )}
        {/* Custom Time Modal for mobile */}
        {isCustomTimeModalOpen && customTimeContext && (
          <CustomTimeModal
            context={customTimeContext}
            staffMembers={dynamicStaff}
            onClose={() => {
              setCustomTimeModalOpen(false);
              setCustomTimeContext(null);
            }}
            onApply={(start, end) => {
              const key = makeCustomTimeKey(start, end);
              handleEditBufferChange(customTimeContext.dayKey, customTimeContext.staffId, key);
              setCustomTimeModalOpen(false);
              setCustomTimeContext(null);
            }}
          />
        )}
      </>
    );
  }

  // Desktop: Render full calendar grid
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* AppHeader: Brand bar with Login (public) - hidden when embedded in AdminPanel */}
      {!hideTitle && (
        <AppHeader
          mode={mode}
          isOnline={isOnline}
          onLoginClick={() => setLoginModalOpen(true)}
        />
      )}

      <div className="max-w-screen-2xl mx-auto p-4">
        <CalendarToolbar
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          isEditMode={isEditMode}
          isAdmin={isAdmin}
          hasDraft={hasDraft}
          onEnterEditMode={handleEnterEditMode}
          onSaveChanges={handleSaveChanges}
          onCancelEdit={handleCancelEdit}
          onPublish={handlePublish}
          onDiscardDraft={handleDiscardDraft}
          onDownloadCSV={handleDownloadCSV}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          copiedWeekNumber={copiedWeek?.weekNumber}
          onClearClipboard={() => setCopiedWeek(null)}
        />

        <div id="calendar-container" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="calendar-grid">
            {DAYS.map((day, idx) => (
              <div key={day} className={`py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 ${idx > 0 ? 'border-l border-gray-200' : ''}`}>{day}</div>
            ))}
            {schedule.days.map(day => (
              <CalendarDay
                key={format(day.date, 'yyyy-MM-dd')}
                day={day}
                staffMembers={dynamicStaff}
                isEditMode={isEditMode}
                editBuffer={editBuffer}
                onEditBufferChange={handleEditBufferChange}
                onWeekMenuClick={handleWeekMenuClick}
              />
            ))}
          </div>
        </div>

        {/* Admin-only features: Staff Hours Overview */}
        {mode === 'admin' && (
          <StaffHoursOverview
            weeklyHourSummaries={weeklyHourSummaries}
            monthlyHourTotals={monthlyHourTotals}
          />
        )}

        {isReplacementModalOpen && (
          <ReplacementModal
            context={replacementContext}
            onClose={() => setReplacementModalOpen(false)}
            onSave={handleSaveReplacement}
          />
        )}

        {/* Login Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          redirectTo={loginRedirectTo}
        />

        {/* Maternity Leave Modal */}
        {maternityContext && (
          <MaternityLeaveModal
            isOpen={isMaternityModalOpen}
            onClose={() => {
              setMaternityModalOpen(false);
              setMaternityContext(null);
            }}
            staffId={maternityContext.staffId}
            initialDate={new Date(maternityContext.dayKey)}
            onConfirm={handleMaternityLeaveConfirm}
          />
        )}

        {/* Custom Time Modal */}
        {isCustomTimeModalOpen && customTimeContext && (
          <CustomTimeModal
            context={customTimeContext}
            staffMembers={dynamicStaff}
            onClose={() => {
              setCustomTimeModalOpen(false);
              setCustomTimeContext(null);
            }}
            onApply={(start, end) => {
              const key = makeCustomTimeKey(start, end);
              handleEditBufferChange(customTimeContext.dayKey, customTimeContext.staffId, key);
              setCustomTimeModalOpen(false);
              setCustomTimeContext(null);
            }}
          />
        )}

        {/* Week Action Popup (Copy/Paste) */}
        {weekMenuOpen && (
          <WeekActionPopup
            weekNumber={weekMenuOpen.weekNumber}
            position={weekMenuOpen.position}
            copiedWeek={copiedWeek}
            onCopy={() => handleCopyWeek(weekMenuOpen.weekNumber)}
            onPaste={() => handlePasteWeek(weekMenuOpen.weekNumber)}
            onClose={() => setWeekMenuOpen(null)}
          />
        )}
      </div>
    </div>
  );
}

// ================================================================================================
// Sub-Components for a Cleaner Structure
// ================================================================================================

function CalendarToolbar({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, isEditMode, isAdmin, hasDraft, onEnterEditMode, onSaveChanges, onCancelEdit, onPublish, onDiscardDraft, onDownloadCSV, onPrevMonth, onNextMonth, onToday, copiedWeekNumber, onClearClipboard }: {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  isEditMode: boolean;
  isAdmin: boolean;
  hasDraft: boolean;
  onEnterEditMode: () => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onPublish: () => void;
  onDiscardDraft: () => void;
  onDownloadCSV: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  copiedWeekNumber?: number | null;
  onClearClipboard?: () => void;
}) {
  return (
    <div className="mb-4">
      {/* Toolbar: Month/Year pickers | Navigation | Admin buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Month/Year pickers */}
        <div className="flex items-center gap-1">
          <div className="relative flex items-center">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none text-[14px] md:text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded pl-2 pr-6 py-1 focus:outline-none"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-1 h-4 w-4 text-gray-500 pointer-events-none" />
          </div>
          <div className="relative flex items-center">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none text-[14px] md:text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded pl-2 pr-6 py-1 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-1 h-4 w-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Right: Navigation + Admin buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Navigation: < Today > */}
          <div className="inline-flex items-center">
            <button
              onClick={onPrevMonth}
              className="p-1 md:p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors"
            >
              <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button
              onClick={onToday}
              className="px-2 md:px-3 py-1 text-[#37352f] hover:bg-[#f1f1ef] rounded transition-colors text-[13px] md:text-[14px]"
            >
              Today
            </button>
            <button
              onClick={onNextMonth}
              className="p-1 md:p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors"
            >
              <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>

          {/* Admin-only buttons */}
          {isAdmin && (
            <>
              <div className="w-px h-4 bg-[#e3e2e0] mx-0.5 md:mx-1 hidden md:block" />
              {/* CSV Button */}
              <button onClick={onDownloadCSV} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Download size={14}/>
                <span>CSV</span>
              </button>
              {/* Draft Workflow Buttons */}
              {isEditMode ? (
                /* State 1: Currently editing - Show Clipboard Badge + Save Draft + Cancel */
                <>
                  {/* Clipboard Badge - shows copied week */}
                  {copiedWeekNumber && onClearClipboard && (
                    <ClipboardBadge weekNumber={copiedWeekNumber} onClear={onClearClipboard} />
                  )}
                  <button onClick={onSaveChanges} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors">
                    <Save size={14}/>
                    <span className="hidden sm:inline">Save Draft</span>
                  </button>
                  <button onClick={onCancelEdit} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors">
                    <X size={16}/>
                  </button>
                </>
              ) : hasDraft ? (
                /* State 2: Has draft, not editing - Show Publish + Discard + Edit */
                <>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full hidden sm:inline">
                    Unpublished
                  </span>
                  <button onClick={onPublish} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors">
                    <Check size={14}/>
                    <span className="hidden sm:inline">Publish</span>
                  </button>
                  <button onClick={onDiscardDraft} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100 transition-colors">
                    <Trash2 size={14}/>
                    <span className="hidden sm:inline">Discard</span>
                  </button>
                  <button onClick={onEnterEditMode} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors">
                    <Edit size={14}/>
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                </>
              ) : (
                /* State 3: No draft, not editing - Show Edit button */
                <button onClick={onEnterEditMode} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors">
                  <Edit size={14}/>
                  <span className="hidden sm:inline">Edit Mode</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarDay({ day, staffMembers, isEditMode, editBuffer, onEditBufferChange, onWeekMenuClick }: {
  day: DaySchedule,
  staffMembers: DatabaseStaffMember[],
  isEditMode: boolean,
  editBuffer: Record<string, Record<string, string>>,
  onEditBufferChange: (dayKey: string, staffId: string, value: string) => void,
  onWeekMenuClick?: (e: React.MouseEvent, weekNumber: number) => void
}) {
  const dayKey = format(day.date, 'yyyy-MM-dd');
  const today = new Date();
  const isToday = format(day.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  const isSunday = day.date.getDay() === 0; // 0 = Sunday
  const weekNumber = getISOWeek(day.date);

  // Filter staff members who have shifts on this day (are active on this date)
  const activeStaff = staffMembers.filter(staff => day.staffShifts[staff.id] !== undefined);

  return (
    <div className={`border-t border-l border-gray-100 p-2 md:p-3 min-h-[160px] md:min-h-[200px] ${day.isHoliday ? 'bg-red-50' : day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'}`}>
      <div className="flex justify-between items-start mb-2 md:mb-3">
        {/* Date number with blue circle for today */}
        {isToday ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white font-semibold text-xs flex-shrink-0">
            {format(day.date, 'd')}
          </span>
        ) : (
          <span className={`font-semibold text-sm ${!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>{format(day.date, 'd')}</span>
        )}
        {/* Right side: Week number or holiday, with kebab menu on Sundays in edit mode */}
        <div className="flex items-center gap-1">
          {isEditMode && isSunday && onWeekMenuClick && (
            <button
              onClick={(e) => onWeekMenuClick(e, weekNumber)}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              title={`Week ${weekNumber} actions`}
            >
              <MoreVertical size={14} className="text-gray-400" />
            </button>
          )}
          {day.isHoliday ? (
            <span className="text-[10px] md:text-xs text-red-500 font-medium truncate max-w-[50px] md:max-w-[80px]" title={day.holidayName}>{day.holidayName}</span>
          ) : (
            <span className="text-[10px] md:text-xs text-gray-400 font-medium">W{weekNumber}</span>
          )}
        </div>
      </div>
      <div className="space-y-1 md:space-y-2">
        {activeStaff.map(staff => (
          <StaffCard
            key={staff.id}
            staff={staff}
            day={day}
            isEditMode={isEditMode}
            editValue={editBuffer[dayKey]?.[staff.id]}
            onEditChange={(value) => onEditBufferChange(dayKey, staff.id, value)}
          />
        ))}
        {(day.replacementShifts || []).map(rep => (
          <ReplacementCard key={rep.id} replacement={rep} />
        ))}
      </div>
    </div>
  );
}

function StaffCard({ staff, day, isEditMode, editValue, onEditChange }: { staff: DatabaseStaffMember, day: DaySchedule, isEditMode: boolean, editValue: string, onEditChange: (value: string) => void }) {
  const staffShift = day.staffShifts[staff.id];
  // Use getStaffColors for dynamic color lookup (works for both legacy and new staff)
  const staffColors = getStaffColors(staff.id, staff.colorIndex);
  const colorTheme = staffColors.card;

  // Determine if "off" based on edit mode state
  let isOff: boolean;
  if (isEditMode && editValue) {
    // In edit mode, use the pending editValue to determine color
    isOff = editValue === 'off';
  } else {
    // Not in edit mode, use current staffShift data
    isOff = !staffShift.shift && !staffShift.isLeave;
  }

  // Use grey styling when staff is off
  const cardBg = isOff ? 'bg-gray-50' : colorTheme.bg;
  const cardText = isOff ? 'text-gray-400' : colorTheme.text;

  return (
    <div className={`${cardBg} ${cardText} rounded-lg p-1.5 md:p-2 text-[10px] md:text-xs`}>
      <div className="font-bold mb-0.5 md:mb-1 truncate">{staff.name}</div>
      {isEditMode ? (
        <ShiftDropdown value={editValue} onChange={onEditChange} />
      ) : (
        <ShiftDisplay staffShift={staffShift} staffId={staff.id} colorIndex={staff.colorIndex} />
      )}
    </div>
  );
}

function ShiftDisplay({ staffShift, staffId, colorIndex }: { staffShift: DaySchedule['staffShifts'][string], staffId: string, colorIndex?: number | null }) {
  const { shift } = staffShift;
  // Use getStaffColors for dynamic bar color lookup
  const staffColors = getStaffColors(staffId, colorIndex);
  const barColor = staffColors.bar;

  // Leave state
  if (staffShift.isLeave) {
    return (
      <div>
        <div className="font-bold text-orange-600 text-[10px] md:text-xs">{staffShift.leaveType}</div>
        {/* Empty placeholder for consistent height */}
        <div className="mt-0.5 md:mt-1 h-1 md:h-1.5" />
      </div>
    );
  }

  // Off state
  if (!shift) {
    return (
      <div>
        <div className="text-gray-500 text-[10px] md:text-xs">Off</div>
        {/* Empty placeholder for consistent height */}
        <div className="mt-0.5 md:mt-1 h-1 md:h-1.5" />
      </div>
    );
  }

  // Working shift
  return (
    <div>
      {/* Time text row */}
      <div className="flex items-center justify-between font-mono text-[9px] md:text-xs">
        <span className="opacity-80">{shift.startTime}-{shift.endTime}</span>
        <span className="font-semibold">({shift.type === 'custom' ? `${shift.workHours}h` : shift.type})</span>
      </div>
      {/* Timeline bar */}
      <div className="mt-1 md:mt-1.5 h-1.5 md:h-2 bg-white/50 rounded-full relative overflow-hidden">
        <div
          className={`absolute h-full rounded-full ${barColor}`}
          style={{
            left: `${calculateBarStart(shift.startTime)}%`,
            width: `${calculateBarWidth(shift.startTime, shift.endTime)}%`
          }}
        />
      </div>
    </div>
  );
}

function ShiftDropdown({ value, onChange }: { value: string, onChange: (value: string) => void }) {
  const customParsed = isCustomTimeKey(value) ? parseCustomTimeKey(value) : null;

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-1 border-gray-300 rounded-md text-xs bg-white/50">
      <optgroup label="Status">
        <option value="off">Off</option>
      </optgroup>
      <optgroup label="Leave">
        <option value="leave_al">Annual Leave</option>
        <option value="leave_rl">Replacement Leave</option>
        <option value="leave_el">Emergency Leave</option>
        <option value="leave_ml">Medical Leave</option>
        <option value="leave_mat">Maternity Leave (98 days)...</option>
      </optgroup>
      <optgroup label="Actions">
         <option value="add_replacement">Add Replacement...</option>
      </optgroup>
      <optgroup label="Shifts">
        {Object.keys(SHIFT_DEFINITIONS).filter(key => !RAMADAN_SHIFT_KEYS.has(key)).map(key => {
          const shift = SHIFT_DEFINITIONS[key];
          return <option key={key} value={key}>{`${shift.type} (${shift.startTime}-${shift.endTime})`}</option>
        })}
      </optgroup>
      <optgroup label="Ramadan">
        {Object.keys(SHIFT_DEFINITIONS).filter(key => RAMADAN_SHIFT_KEYS.has(key)).map(key => {
          const shift = SHIFT_DEFINITIONS[key];
          return <option key={key} value={key}>{`${shift.type} (${shift.startTime}-${shift.endTime})`}</option>
        })}
      </optgroup>
      <optgroup label="Custom">
        <option value="custom_time_picker">Custom Time...</option>
        {customParsed && (
          <option value={value}>{`✎ ${customParsed.startTime}-${customParsed.endTime} (${customParsed.workHours}h)`}</option>
        )}
      </optgroup>
    </select>
  );
}

// Week action popup for copy/paste functionality
interface WeekActionPopupProps {
  weekNumber: number;
  position: { x: number; y: number };
  copiedWeek: { weekNumber: number; label: string } | null;
  onCopy: () => void;
  onPaste: () => void;
  onClose: () => void;
}

function WeekActionPopup({ weekNumber, position, copiedWeek, onCopy, onPaste, onClose }: WeekActionPopupProps) {
  // Close popup when clicking outside
  const popupRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Add listener with delay to avoid immediate close from the triggering click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const canPaste = copiedWeek && copiedWeek.weekNumber !== weekNumber;

  return (
    <div
      ref={popupRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
      style={{ top: position.y, left: Math.max(8, position.x) }}
    >
      <button
        onClick={onCopy}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700"
      >
        <Copy size={14} />
        Copy W{weekNumber}
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={onPaste}
        disabled={!canPaste}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 disabled:text-gray-400"
      >
        <ClipboardPaste size={14} />
        {copiedWeek ? `Paste W${copiedWeek.weekNumber}` : 'Paste (nothing copied)'}
      </button>
    </div>
  );
}

// Clipboard badge shown in toolbar when a week is copied
function ClipboardBadge({ weekNumber, onClear }: { weekNumber: number; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
      title="Click to clear clipboard"
    >
      W{weekNumber}
      <Clipboard size={12} />
      <X size={12} />
    </button>
  );
}

function ReplacementModal({ context, onClose, onSave }: { context: { dayKey: string; staffId: string } | null, onClose: () => void, onSave: (name: string, start: string, end: string, breakHours: string) => void}) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakHours, setBreakHours] = useState('1'); // Default break is 1 hour

  const staffName = context ? STAFF_MEMBERS.find(s => s.id === context.staffId)?.name : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-4 md:p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <UserPlus className="text-blue-600 w-5 h-5 md:w-6 md:h-6" />
          <h3 className="text-base md:text-lg font-bold text-gray-800">Add Temporary Replacement</h3>
        </div>
        <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">You are adding a replacement for <strong>{staffName}</strong> on <strong>{context && format(new Date(context.dayKey), 'EEE, MMM d')}</strong>. Their shift will be set to &apos;Off&apos;.</p>
        <div className="space-y-3 md:space-y-4">
          <input type="text" placeholder="Temporary Staff Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"/>
          <div className="flex gap-2 md:gap-4">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"/>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"/>
          </div>
          <div>
            <label htmlFor="break-hours" className="block text-xs md:text-sm font-medium text-gray-700 mt-3 md:mt-4">Break (hours)</label>
            <input
              type="number"
              id="break-hours"
              value={breakHours}
              onChange={e => setBreakHours(e.target.value)}
              className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 mt-1 text-sm"
              step="0.5"
              min="0"
              placeholder="e.g., 1.5"
            />
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 mt-4 md:mt-6">
          <button onClick={onClose} className="w-full p-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm">Cancel</button>
          <button onClick={() => onSave(name, startTime, endTime, breakHours)} className="flex-1 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save</button>
        </div>
      </div>
    </div>
  )
}

function CustomTimeModal({ context, staffMembers, onClose, onApply }: {
  context: { dayKey: string; staffId: string } | null;
  staffMembers: (StaffMember | DatabaseStaffMember)[];
  onClose: () => void;
  onApply: (startTime: string, endTime: string) => void;
}) {
  const [startTime, setStartTime] = useState('09:15');
  const [endTime, setEndTime] = useState('18:00');

  const staffName = context ? (staffMembers.find(s => s.id === context.staffId)?.name || STAFF_MEMBERS.find(s => s.id === context.staffId)?.name) : '';
  const dateLabel = context ? format(new Date(context.dayKey + 'T00:00:00'), 'EEE, MMM d') : '';

  // Calculate work hours
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const workHours = endMinutes > startMinutes
    ? Math.round((endMinutes - startMinutes) / 60 * 10) / 10
    : 0;

  // Validation
  const isValid = endMinutes > startMinutes
    && startMinutes >= timeToMinutes('09:15')
    && endMinutes <= timeToMinutes('21:45');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-4 md:p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Clock className="text-blue-600 w-5 h-5 md:w-6 md:h-6" />
          <h3 className="text-base md:text-lg font-bold text-gray-800">Custom Shift Time</h3>
        </div>
        <p className="text-xs md:text-sm text-gray-600 mb-3">
          <strong>{staffName}</strong> · {dateLabel}
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                min="09:15"
                max="21:45"
                onChange={e => setStartTime(e.target.value)}
                className="w-full p-2 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End</label>
              <input
                type="time"
                value={endTime}
                min="09:15"
                max="21:45"
                onChange={e => setEndTime(e.target.value)}
                className="w-full p-2 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="text-sm text-gray-700">
            Work Hours: <strong className="font-mono">{workHours > 0 ? `${workHours}h` : '—'}</strong>
          </div>
          {!isValid && startTime && endTime && (
            <p className="text-xs text-red-500">End time must be after start time, within 09:15–21:45</p>
          )}
        </div>
        <div className="flex gap-2 md:gap-3 mt-4 md:mt-6">
          <button onClick={onClose} className="w-full p-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm">Cancel</button>
          <button
            onClick={() => onApply(startTime, endTime)}
            disabled={!isValid}
            className="flex-1 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplacementCard({ replacement }: { replacement: ReplacementShift }) {
  return (
    <div className="bg-gray-100 border-l-4 border-gray-400 rounded-lg p-1.5 md:p-2 text-[10px] md:text-xs text-gray-700">
      <div className="font-bold flex justify-between mb-0.5 md:mb-0">
        <span className="truncate">{replacement.tempStaffName}</span>
        <span className="text-gray-500 italic text-[9px] md:text-xs">Temp</span>
      </div>
      <div>
        {/* Time text row */}
        <div className="flex items-center justify-between font-mono text-[9px] md:text-xs">
          <span className="opacity-80">{replacement.startTime}-{replacement.endTime}</span>
          <span className="font-semibold">({replacement.workHours}h)</span>
        </div>
        {/* Timeline bar */}
        <div className="mt-1 md:mt-1.5 h-1.5 md:h-2 bg-white/50 rounded-full relative overflow-hidden">
          <div
            className="absolute h-full rounded-full bg-gray-500"
            style={{
              left: `${calculateBarStart(replacement.startTime)}%`,
              width: `${calculateBarWidth(replacement.startTime, replacement.endTime)}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ================================================================================================
// Mobile View Components
// ================================================================================================

// Helper function for shift labels
function getShiftLabel(shift: ShiftDefinition | null): string {
  if (!shift) return 'Day Off';
  if (shift.type === 'custom') return 'Custom Shift';
  if (shift.type === '11h') return 'Full Day Shift';
  return shift.timing === 'early' ? 'Early Shift' : 'Late Shift';
}

interface MobileViewProps {
  schedule: MonthSchedule;
  staffMembers: DatabaseStaffMember[];
  selectedDayIndex: number;
  setSelectedDayIndex: (index: number) => void;
  currentWeekNumber: number;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  setPendingDateToSelect: (date: Date | null) => void;
  isAdmin: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  mode: 'public' | 'admin';
  onLoginClick: () => void;
  hideMobileLogout?: boolean;
  // Edit mode props
  isEditMode: boolean;
  editBuffer: Record<string, Record<string, string>>;
  hasDraft: boolean;
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSaveChanges: () => void;
  onPublish: () => void;
  onDiscardDraft: () => void;
  onEditBufferChange: (dayKey: string, staffId: string, value: string) => void;
  onMobileTabChange?: (tab: Tab) => void;
  onOpenMaternityModal: (dayKey: string, staffId: string) => void;
}

function MobileView({
  schedule,
  staffMembers,
  selectedDayIndex,
  setSelectedDayIndex,
  currentWeekNumber,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  setPendingDateToSelect,
  isAdmin,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  mode,
  onLoginClick,
  isEditMode,
  editBuffer,
  hasDraft,
  onEnterEditMode,
  onCancelEdit,
  onSaveChanges,
  onPublish,
  onDiscardDraft,
  onEditBufferChange,
  onMobileTabChange,
  onOpenMaternityModal,
}: MobileViewProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const selectedDay = schedule.days[selectedDayIndex];

  // Drawer and bottom sheet state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<{
    staff: DatabaseStaffMember;
    dayKey: string;
  } | null>(null);

  if (!selectedDay) return null;

  const dayKey = format(selectedDay.date, 'yyyy-MM-dd');

  // Handle date selection - auto-change month if selecting adjacent month date
  const handleDateSelect = (index: number) => {
    const selectedDate = schedule.days[index];
    const dateMonth = selectedDate.date.getMonth() + 1;
    const dateYear = selectedDate.date.getFullYear();

    // If selected date is in different month, change month
    if (dateMonth !== selectedMonth || dateYear !== selectedYear) {
      setSelectedMonth(dateMonth);
      setSelectedYear(dateYear);
      setPendingDateToSelect(selectedDate.date);
    } else {
      setSelectedDayIndex(index);
    }
  };

  // Handle staff card tap in edit mode
  const handleStaffCardTap = (staff: StaffMember) => {
    if (isEditMode) {
      setSelectedStaffForEdit({ staff, dayKey });
    }
  };

  // Handle shift selection from bottom sheet
  const handleShiftSelect = (shiftKey: string) => {
    if (selectedStaffForEdit) {
      // Map the shift key to the correct format for editBuffer
      let bufferValue = shiftKey;
      if (['AL', 'RL', 'EL', 'ML', 'MAT'].includes(shiftKey)) {
        bufferValue = `leave_${shiftKey.toLowerCase()}`;
      }
      onEditBufferChange(selectedStaffForEdit.dayKey, selectedStaffForEdit.staff.id, bufferValue);
      setSelectedStaffForEdit(null);
    }
  };

  // Handle custom time selection from bottom sheet
  const handleCustomTimeSelect = (startTime: string, endTime: string) => {
    if (selectedStaffForEdit) {
      const key = makeCustomTimeKey(startTime, endTime);
      onEditBufferChange(selectedStaffForEdit.dayKey, selectedStaffForEdit.staff.id, key);
      setSelectedStaffForEdit(null);
    }
  };

  // Handle maternity leave selection from bottom sheet (opens modal)
  const handleMaternitySelect = () => {
    if (selectedStaffForEdit) {
      onOpenMaternityModal(selectedStaffForEdit.dayKey, selectedStaffForEdit.staff.id);
      setSelectedStaffForEdit(null);
    }
  };

  // Handle tab change from drawer
  const handleTabChange = (tab: Tab) => {
    if (onMobileTabChange) {
      onMobileTabChange(tab);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Get current value for the shift picker
  const getCurrentShiftValue = (): string => {
    if (!selectedStaffForEdit) return 'off';
    const bufferValue = editBuffer[selectedStaffForEdit.dayKey]?.[selectedStaffForEdit.staff.id] || 'off';
    // Convert leave_xx format back to XX for display
    if (bufferValue.startsWith('leave_')) {
      return bufferValue.split('_')[1].toUpperCase();
    }
    // Pass custom keys through as-is
    return bufferValue;
  };

  // Check if admin mode
  const isAdminMode = mode === 'admin' || isAdmin;

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-28">
      {/* Header with title and draft badge */}
      <MobileHeader
        mode={mode}
        onLoginClick={onLoginClick}
        isEditMode={isEditMode}
        hasDraft={hasDraft}
      />

      {/* Controls: Month/Year + Week Nav */}
      <MobileControls
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        weekNumber={currentWeekNumber}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
      />

      {/* Day Header */}
      <MobileDayHeader day={selectedDay} weekNumber={currentWeekNumber} />

      {/* Staff Cards */}
      <div className="px-4 space-y-3 mt-3">
        {/* Filter to only show staff who have shifts on this day (are active) */}
        {staffMembers.filter(staff => selectedDay.staffShifts[staff.id] !== undefined).map(staff => (
          <MobileStaffCard
            key={staff.id}
            staff={staff}
            staffShift={selectedDay.staffShifts[staff.id]}
            isEditMode={isEditMode}
            editValue={editBuffer[dayKey]?.[staff.id]}
            onTap={() => handleStaffCardTap(staff)}
          />
        ))}
        {/* Replacement shifts */}
        {(selectedDay.replacementShifts || []).map(rep => (
          <MobileReplacementCard key={rep.id} replacement={rep} />
        ))}
      </div>

      {/* Bottom Bar: Menu + Day Selector + Actions */}
      <MobileBottomBar
        state={isEditMode ? 'edit' : hasDraft ? 'draft' : 'view'}
        days={schedule.days}
        selectedIndex={selectedDayIndex}
        onSelectDay={handleDateSelect}
        onGoToToday={onGoToToday}
        onMenuOpen={() => setIsDrawerOpen(true)}
        onCancelEdit={onCancelEdit}
        onSaveChanges={onSaveChanges}
        onEnterEditMode={onEnterEditMode}
        onPublish={onPublish}
        isAdmin={isAdminMode}
      />

      {/* Drawer Menu - Admin only */}
      {isAdminMode && (
        <MobileDrawerMenu
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeTab="timetable"
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          hasDraft={hasDraft}
          onDiscardDraft={onDiscardDraft}
        />
      )}

      {/* Shift Picker Bottom Sheet */}
      {selectedStaffForEdit && (
        <ShiftPickerBottomSheet
          isOpen={!!selectedStaffForEdit}
          onClose={() => setSelectedStaffForEdit(null)}
          staff={selectedStaffForEdit.staff}
          currentValue={getCurrentShiftValue()}
          onSelect={handleShiftSelect}
          onMaternitySelect={handleMaternitySelect}
          onCustomTimeSelect={handleCustomTimeSelect}
        />
      )}
    </div>
  );
}

interface MobileHeaderProps {
  mode: 'public' | 'admin';
  onLoginClick: () => void;
  isEditMode: boolean;
  hasDraft: boolean;
}

function MobileHeader({
  mode,
  onLoginClick,
  isEditMode,
  hasDraft,
}: MobileHeaderProps) {
  const isAdminMode = mode === 'admin';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Left: Logo + Title + Draft badge */}
      <div className="flex items-center gap-2">
        <AldeIcon />
        <h1 className="text-lg font-bold text-[#37352f]">
          {isEditMode ? 'Editing...' : 'Farmasi Alde ST Timetable'}
        </h1>
        {/* Draft badge - only show in admin mode when has draft and not editing */}
        {isAdminMode && hasDraft && !isEditMode && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            Draft
          </span>
        )}
      </div>

      {/* Right: Login button for public mode only */}
      {!isAdminMode && (
        <button
          onClick={onLoginClick}
          className="p-2 text-[#91918e] hover:bg-[#f1f1ef] rounded-full transition-colors"
        >
          <User size={22} />
        </button>
      )}
    </div>
  );
}

function MobileControls({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  weekNumber,
  onPrevWeek,
  onNextWeek,
}: {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  weekNumber: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Month/Year Dropdowns */}
      <div className="flex gap-1">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="px-2 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-[#37352f] border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-2 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-[#37352f] border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-1.5 py-1">
        <button onClick={onPrevWeek} className="p-1 hover:bg-gray-200 rounded transition-colors">
          <ChevronLeft size={18} className="text-[#37352f]" />
        </button>
        <span className="text-sm font-medium px-2 text-[#37352f] min-w-[60px] text-center">Week {weekNumber}</span>
        <button onClick={onNextWeek} className="p-1 hover:bg-gray-200 rounded transition-colors">
          <ChevronRight size={18} className="text-[#37352f]" />
        </button>
      </div>
    </div>
  );
}

function MobileDayHeader({ day, weekNumber }: { day: DaySchedule; weekNumber: number }) {
  return (
    <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#37352f]">
          {format(day.date, 'EEEE, MMM d')}
        </h2>
        <span className="text-sm text-[#91918e] font-medium">Week {weekNumber}</span>
      </div>
      {day.isHoliday && (
        <div className="mt-1 text-sm text-red-600 font-medium">
          {day.holidayName}
        </div>
      )}
    </div>
  );
}

interface MobileStaffCardProps {
  staff: DatabaseStaffMember;
  staffShift: DaySchedule['staffShifts'][string];
  isEditMode?: boolean;
  editValue?: string;
  onTap?: () => void;
}

function MobileStaffCard({ staff, staffShift, isEditMode = false, editValue, onTap }: MobileStaffCardProps) {
  // Use getStaffColors for dynamic color lookup (works for both legacy and new staff)
  const staffColors = getStaffColors(staff.id, staff.colorIndex);
  const avatarColors = staffColors.avatar;
  const initials = staff.name.substring(0, 2).toUpperCase();

  // Determine display state based on editValue if in edit mode
  let displayShift = staffShift.shift;
  let displayIsLeave = staffShift.isLeave;
  let displayLeaveType = staffShift.leaveType;

  if (isEditMode && editValue) {
    if (editValue === 'off') {
      displayShift = null;
      displayIsLeave = false;
      displayLeaveType = undefined;
    } else if (editValue.startsWith('leave_')) {
      displayShift = null;
      displayIsLeave = true;
      displayLeaveType = editValue.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL' | 'ML' | 'MAT';
    } else if (isCustomTimeKey(editValue)) {
      const parsed = parseCustomTimeKey(editValue);
      if (parsed) {
        displayShift = { type: 'custom', timing: null, ...parsed };
      }
      displayIsLeave = false;
      displayLeaveType = undefined;
    } else if (SHIFT_DEFINITIONS[editValue]) {
      displayShift = SHIFT_DEFINITIONS[editValue];
      displayIsLeave = false;
      displayLeaveType = undefined;
    }
  }

  const isOff = !displayShift && !displayIsLeave;
  const isLeave = displayIsLeave;
  const isNotWorking = isOff || isLeave;

  // Badge styling - monospace for hours, muted for status
  const badgeClasses = isNotWorking
    ? 'bg-gray-100 text-gray-500 text-[11px]'
    : `${avatarColors.badge} font-mono`;

  // Card styling - compact muted card for non-working, full card for working
  let cardClasses = isNotWorking
    ? 'bg-gray-50/80 rounded-xl py-3 px-4 border border-dashed border-gray-200'
    : 'bg-white rounded-xl p-4 shadow-sm';

  // Add edit mode styling
  if (isEditMode) {
    cardClasses += ' cursor-pointer ring-2 ring-blue-200 hover:ring-blue-400 transition-all';
  }

  // Avatar styling - gray and smaller for non-working
  const avatarBg = isNotWorking ? 'bg-gray-300' : avatarColors.bg;
  const avatarSize = isNotWorking ? 'w-8 h-8' : 'w-10 h-10';
  const avatarTextSize = isNotWorking ? 'text-[10px]' : 'text-xs';
  const barColor = staffColors.bar;

  const handleClick = () => {
    if (isEditMode && onTap) {
      onTap();
    }
  };

  // Compact single-line for non-working staff
  if (isNotWorking) {
    return (
      <div className={cardClasses} onClick={handleClick}>
        <div className="flex items-center gap-3">
          {/* Smaller gray avatar */}
          <div className={`${avatarSize} ${avatarBg} rounded-full flex items-center justify-center flex-shrink-0`}>
            <span className={`text-white font-semibold ${avatarTextSize}`}>{initials}</span>
          </div>

          {/* Name only */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-500 truncate">{staff.name}</h3>
          </div>

          {/* Status badge + Edit indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClasses}`}>
              {isLeave ? displayLeaveType : 'OFF'}
            </span>
            {isEditMode && (
              <ChevronDown size={16} className="text-blue-500" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full card for working staff
  return (
    <div className={cardClasses} onClick={handleClick}>
      {/* Top section: Avatar + Info + Badge */}
      <div className="flex items-center gap-3">
        {/* Avatar with border/shadow */}
        <div className={`${avatarSize} ${avatarBg} rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-md`}>
          <span className={`text-white font-bold ${avatarTextSize}`}>{initials}</span>
        </div>

        {/* Name and combined shift info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{staff.name}</h3>
          <p className="text-sm text-gray-500">
            {getShiftLabel(displayShift)}
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="font-mono text-gray-400">{displayShift?.startTime}–{displayShift?.endTime}</span>
          </p>
        </div>

        {/* Hours Badge + Edit indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${badgeClasses}`}>
            {displayShift?.type === 'custom' ? `${displayShift.workHours}h` : displayShift?.type}
          </span>
          {isEditMode && (
            <ChevronDown size={18} className="text-blue-500" />
          )}
        </div>
      </div>

      {/* Progress Bar - visual timeline */}
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{
            marginLeft: `${calculateBarStart(displayShift!.startTime)}%`,
            width: `${calculateBarWidth(displayShift!.startTime, displayShift!.endTime)}%`
          }}
        />
      </div>
    </div>
  );
}

function MobileReplacementCard({ replacement }: { replacement: ReplacementShift }) {
  const initials = replacement.tempStaffName.substring(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-gray-400">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-[#37352f] truncate">{replacement.tempStaffName}</h3>
              <p className="text-sm text-[#91918e] italic">Temp Replacement</p>
            </div>
            {/* Hours Badge */}
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 flex-shrink-0">
              {replacement.workHours}h
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-500"
              style={{
                marginLeft: `${calculateBarStart(replacement.startTime)}%`,
                width: `${calculateBarWidth(replacement.startTime, replacement.endTime)}%`
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-[#91918e]">
            <Clock size={14} />
            <span>{replacement.startTime} - {replacement.endTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// MobileDaySelector removed - replaced by MobileBottomBar component

 