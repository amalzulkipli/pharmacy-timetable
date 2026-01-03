'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateMonthSchedule, getWeeklyHourSummaries, getMonthlyHourTotals, exportToCSV } from '../lib/schedule-generator';
import { STAFF_MEMBERS, SHIFT_DEFINITIONS, STAFF_COLORS, AVATAR_COLORS } from '../staff-data';
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift, WeeklyHourSummary } from '../types/schedule';
import { format, getISOWeek, differenceInMinutes } from 'date-fns';
import { Download, Edit, Save, X, UserPlus, ChevronLeft, ChevronRight, User, LogOut, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useScheduleOverridesDB } from '../hooks/useScheduleDB';
import LoginModal from './LoginModal';


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

// Solid bar colors for timeline (more vibrant than card backgrounds)
const BAR_COLORS: { [key: string]: string } = {
  fatimah: 'bg-blue-500',    // Blue bar (matches card theme)
  siti: 'bg-green-500',      // Green bar
  pah: 'bg-purple-500',      // Purple bar
  amal: 'bg-pink-500',       // Pink bar
};

// ================================================================================================
// Main Calendar Component
// ================================================================================================

interface CalendarProps {
  mode?: 'public' | 'admin';
  hideTitle?: boolean;
}

export default function Calendar({ mode = 'public', hideTitle = false }: CalendarProps) {
  const authContext = useAuth();
  // In admin mode, always treat as admin; in public mode, use auth context
  const isAdmin = mode === 'admin' || authContext.isAdmin;
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [schedule, setSchedule] = useState<MonthSchedule | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Record<string, Record<string, string>>>({});

  // Type for override structure
  type OverrideData = Record<string, { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' } | ReplacementShift[]>;

  // Use database-backed hook for overrides (with localStorage fallback)
  const {
    overrides: dbOverrides,
    saveOverrides,
    isLoading: isLoadingOverrides,
    isOnline
  } = useScheduleOverridesDB({
    year: selectedYear,
    month: selectedMonth,
  });

  // Local state for manual overrides (synced from DB)
  const [manualOverrides, setManualOverrides] = useState<Record<string, OverrideData>>({});
  
  // State for the replacement modal
  const [isReplacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacementContext, setReplacementContext] = useState<{ dayKey: string; staffId: string } | null>(null);

  // State for the login modal
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);

  // --- Mobile View State ---
  const [isMobile, setIsMobile] = useState(false);
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
  // Sync local state with DB overrides
  useEffect(() => {
    if (dbOverrides) {
      setManualOverrides(dbOverrides as Record<string, OverrideData>);
    }
  }, [dbOverrides]);

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
            const override = overrides[dayKey][staffId] as { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' };
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

    const baseSchedule = generateMonthSchedule(selectedMonth, selectedYear);
    const updatedSchedule = applyOverrides(baseSchedule, manualOverrides);
    setSchedule(updatedSchedule);
  }, [selectedMonth, selectedYear, manualOverrides]);

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
      STAFF_MEMBERS.forEach(staff => {
        const { shift, isLeave, leaveType } = day.staffShifts[staff.id];
        let key = 'off';
        if (isLeave) {
          key = `leave_${leaveType?.toLowerCase()}`;
        } else if (shift) {
          // FIX: Use content-based comparison instead of reference comparison
          // Compare shift properties to find matching SHIFT_DEFINITIONS key
          key = Object.keys(SHIFT_DEFINITIONS).find(k => {
            const def = SHIFT_DEFINITIONS[k];
            return def.startTime === shift.startTime && 
                   def.endTime === shift.endTime && 
                   def.workHours === shift.workHours;
          }) || 'off';
        }
        buffer[dayKey][staff.id] = key;
      });
    });
    setEditBuffer(buffer);
    setIsEditMode(true);
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
        let leaveType: 'AL' | 'RL' | 'EL' | 'ML' | undefined = undefined;

        if (value.startsWith('leave')) {
          isLeave = true;
          leaveType = value.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL' | 'ML';
        } else if (value !== 'off') {
          newShift = SHIFT_DEFINITIONS[value];
        }

        newOverrides[dayKey][staffId] = { shift: newShift, isLeave, leaveType };
      });
    });
    setManualOverrides(newOverrides);
    // Save overrides to database (with localStorage fallback)
    const result = await saveOverrides(newOverrides);
    if (!result.success) {
      console.warn('Saved locally, will sync when online:', result.error);
    }
    setIsEditMode(false);
  };

  const handleEditBufferChange = (dayKey: string, staffId: string, value: string) => {
    if (value === 'add_replacement') {
      setReplacementContext({ dayKey, staffId });
      setReplacementModalOpen(true);
      return;
    }
    setEditBuffer(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], [staffId]: value } }));
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

  const handleDownloadPDF = async () => {
    try {
      console.log('🚀 Starting PDF generation with Puppeteer...');
      
      if (!schedule) {
        console.error('❌ No schedule data available');
        alert('No schedule data available for export.');
        return;
      }

      console.log('✅ Schedule found, generating paginated PDF with DOM capture...');
      
      // DIAGNOSTIC: Check schedule data completeness
      console.log('🔍 DIAGNOSTIC - Schedule Data Analysis:', {
        totalDays: schedule.days.length,
        monthYear: `${selectedMonth}/${selectedYear}`,
        firstDay: format(schedule.days[0]?.date, 'yyyy-MM-dd (EEE)'),
        lastDay: format(schedule.days[schedule.days.length - 1]?.date, 'yyyy-MM-dd (EEE)'),
        currentMonthDays: schedule.days.filter(d => d.isCurrentMonth).length,
        totalWeeks: Math.ceil(schedule.days.length / 7),
        expectedDaysRange: '35-42 days for full month grid'
      });
      
      // Get calendar DOM element with perfect styling
      const calendarElement = document.getElementById('calendar-container');
      if (!calendarElement) {
        console.error('❌ Calendar container not found');
        alert('Calendar container not found. Please try refreshing the page.');
        return;
      }

      // Create title and filename
      const monthName = MONTHS[selectedMonth - 1];
      const title = `Timetable ${monthName} ${selectedYear}`;
      const filename = `Timetable-${monthName}-${selectedYear}.pdf`;

      // Get the full HTML including styles
      const extractedStyles = Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch {
            return '';
          }
        })
        .join('\n');

      // Capture the perfect DOM with all styling
      const perfectCalendarHTML = calendarElement.outerHTML;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
              ${extractedStyles}
            </style>
          </head>
          <body>
            <h1 style="text-align: center; font-size: 24px; font-weight: bold; margin: 0 0 20px 0; color: #1f2937;">${title}</h1>
            ${perfectCalendarHTML}
          </body>
        </html>
      `;

      // Send HTML to our API route with title and filename
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          html: htmlContent,
          title: title,
          filename: filename
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      // Get the PDF blob and trigger download
      const pdfBlob = await response.blob();
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('🎉 PDF generated and downloaded successfully!');
      
    } catch (error) {
      console.error('💥 Error during PDF generation:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  

  // --- Memoized Calculations for Performance ---
  const weeklyHourSummaries = useMemo(() => schedule ? getWeeklyHourSummaries(schedule) : [], [schedule]);
  const allReplacementShifts = useMemo(() => schedule ? schedule.days.flatMap(d => (d.replacementShifts || []).map(r => ({...r, date: d.date}))) : [], [schedule]);
  const monthlyHourTotals = useMemo(() => schedule ? getMonthlyHourTotals(schedule) : {}, [schedule]);

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

  if (!schedule || isLoadingOverrides) return <div className="p-8 text-center">Loading Schedule...</div>;

  // Mobile: Render single-day view
  if (isMobile) {
    return (
      <>
        <MobileView
          schedule={schedule}
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
        />
        {/* Login Modal for mobile */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setLoginModalOpen(false)}
        />
      </>
    );
  }

  // Desktop: Render full calendar grid
  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-screen-2xl mx-auto">
        <Header
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          isEditMode={isEditMode}
          isAdmin={isAdmin}
          isOnline={isOnline}
          onEnterEditMode={handleEnterEditMode}
          onSaveChanges={handleSaveChanges}
          onCancelEdit={() => setIsEditMode(false)}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPDF={handleDownloadPDF}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          mode={mode}
          onLoginClick={() => setLoginModalOpen(true)}
          hideTitle={hideTitle}
        />

        <div id="calendar-container" className="bg-white rounded-lg shadow-md">
          <div className="calendar-grid">
            {DAYS.map(day => (
              <div key={day} className="p-2 text-center font-bold text-gray-600 bg-gray-200 border-l border-gray-300 text-sm md:text-base">{day}</div>
            ))}
            {schedule.days.map(day => (
              <CalendarDay
                key={format(day.date, 'yyyy-MM-dd')}
                day={day}
                isEditMode={isEditMode}
                editBuffer={editBuffer}
                onEditBufferChange={handleEditBufferChange}
              />
            ))}
          </div>
        </div>

        {/* Admin-only features: Summaries, Alerts */}
        {mode === 'admin' && (
          <>
            <Summaries weeklyHourSummaries={weeklyHourSummaries} replacementShifts={allReplacementShifts} monthlyHourTotals={monthlyHourTotals} />
            <Alerts schedule={schedule} weeklyHourSummaries={weeklyHourSummaries} isAdmin={true} />
          </>
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
        />
      </div>
    </div>
  );
}

// ================================================================================================
// Sub-Components for a Cleaner Structure
// ================================================================================================

function Header({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, isEditMode, isAdmin, isOnline, onEnterEditMode, onSaveChanges, onCancelEdit, onDownloadCSV, onDownloadPDF, onPrevMonth, onNextMonth, onToday, mode, onLoginClick, hideTitle = false }: {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  isEditMode: boolean;
  isAdmin: boolean;
  isOnline: boolean;
  onEnterEditMode: () => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  mode: 'public' | 'admin';
  onLoginClick: () => void;
  hideTitle?: boolean;
}) {
  const { logout } = useAuth();

  return (
    <div className="mb-4">
      {/* Row 1: Title in white card (hidden in admin panel) */}
      {!hideTitle && (
        <div className="bg-white rounded-lg shadow-md p-3 md:p-4 mb-3 md:mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[18px] md:text-[22px] font-bold text-[#37352f] tracking-tight">Alde ST Timetable</h1>
            {!isOnline && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                Offline Mode
              </span>
            )}
          </div>
        </div>
      )}

      {/* Row 2: Month/Year and Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Month/Year */}
        <div className="flex items-center">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="text-[14px] md:text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded px-1 md:px-2 py-1 -ml-1 focus:outline-none"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-[14px] md:text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded px-1 md:px-2 py-1 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Right: Navigation + Login/Admin buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Navigation */}
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

          {/* Login button (when in public mode and not admin) */}
          {mode === 'public' && !isAdmin && (
            <button onClick={onLoginClick} className="p-1 md:p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors">
              <User size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          )}

          {/* Admin buttons */}
          {isAdmin && (
            <>
              <div className="w-px h-4 bg-[#e3e2e0] mx-0.5 md:mx-1 hidden md:block" />
              {isEditMode ? (
                <>
                  <button onClick={onSaveChanges} className="text-[12px] md:text-[14px] text-white bg-[#2383e2] hover:bg-[#0b6bcb] px-2 md:px-3 py-1 rounded transition-colors flex items-center gap-1"><Save size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Save</span></button>
                  <button onClick={onCancelEdit} className="text-[12px] md:text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-2 md:px-3 py-1 rounded transition-colors flex items-center gap-1"><X size={12} className="md:w-[14px] md:h-[14px]"/></button>
                </>
              ) : (
                <button onClick={onEnterEditMode} className="text-[12px] md:text-[14px] text-white bg-[#2383e2] hover:bg-[#0b6bcb] px-2 md:px-3 py-1 rounded transition-colors flex items-center gap-1"><Edit size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Edit</span></button>
              )}
              <button onClick={onDownloadCSV} className="text-[12px] md:text-[14px] text-[#91918e] hover:bg-[#f1f1ef] p-1 md:px-2 md:py-1 rounded transition-colors hidden sm:block"><Download size={14}/></button>
              <button onClick={onDownloadPDF} className="text-[12px] md:text-[14px] text-[#91918e] hover:bg-[#f1f1ef] p-1 md:px-2 md:py-1 rounded transition-colors">PDF</button>
              <div className="w-px h-4 bg-[#e3e2e0] mx-0.5 md:mx-1 hidden sm:block" />
              <button onClick={logout} className="text-[12px] md:text-[14px] text-[#91918e] hover:bg-[#f1f1ef] p-1 md:px-2 md:py-1 rounded transition-colors"><LogOut size={14}/></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Alerts({ schedule, weeklyHourSummaries, isAdmin }: { schedule: MonthSchedule, weeklyHourSummaries: WeeklyHourSummary[], isAdmin: boolean }) {
  if (!isAdmin) return null;

  const holidayAlerts = schedule.days.filter(d => d.isHoliday && d.isCurrentMonth);
  const hourWarnings = weeklyHourSummaries.filter(s => s.isUnderTarget);

  if (holidayAlerts.length === 0 && hourWarnings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 mb-4">
      {hourWarnings.length > 0 && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 rounded-md text-sm"><b>Hour Warnings:</b> {hourWarnings.map(w => `${w.staffName} (W${w.week}: ${w.actualHours}/${w.targetHours}h)`).join(', ')}</div>}
      {holidayAlerts.length > 0 && <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-3 rounded-md text-sm"><b>Holidays:</b> {holidayAlerts.map(h => `${format(h.date, 'MMM d')}: ${h.holidayName}`).join(', ')}</div>}
    </div>
  )
}

function CalendarDay({ day, isEditMode, editBuffer, onEditBufferChange }: { day: DaySchedule, isEditMode: boolean, editBuffer: Record<string, Record<string, string>>, onEditBufferChange: (dayKey: string, staffId: string, value: string) => void }) {
  const dayKey = format(day.date, 'yyyy-MM-dd');
  const today = new Date();
  const isToday = format(day.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  return (
    <div className={`border-t border-r border-gray-200 p-1.5 md:p-2 min-h-[160px] md:min-h-[200px] ${day.isHoliday ? 'bg-red-100' : day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex justify-between items-start mb-1 md:mb-2 min-h-[20px] md:min-h-[22px]">
        {/* Date number with blue circle for today */}
        {isToday ? (
          <span className="inline-flex items-center justify-center w-5 h-5 md:w-5 md:h-5 rounded-full bg-blue-500 text-white font-semibold text-xs flex-shrink-0">
            {format(day.date, 'd')}
          </span>
        ) : (
          <span className={`font-semibold text-xs md:text-sm ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}`}>{format(day.date, 'd')}</span>
        )}
        {day.isHoliday ? (
          <span className="text-[10px] md:text-xs text-red-600 font-medium truncate max-w-[50px] md:max-w-[80px]" title={day.holidayName}>{day.holidayName}</span>
        ) : (
          <span className="text-[10px] md:text-xs text-gray-500">W{getISOWeek(day.date)}</span>
        )}
      </div>
      <div className="space-y-1 md:space-y-2">
        {STAFF_MEMBERS.map(staff => (
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

function StaffCard({ staff, day, isEditMode, editValue, onEditChange }: { staff: StaffMember, day: DaySchedule, isEditMode: boolean, editValue: string, onEditChange: (value: string) => void }) {
  const staffShift = day.staffShifts[staff.id];
  const colorTheme = STAFF_COLORS[staff.id];
  const isOff = !staffShift.shift && !staffShift.isLeave;

  // Use grey styling when staff is off
  const cardBg = isOff ? 'bg-gray-100' : colorTheme.bg;
  const cardText = isOff ? 'text-gray-400' : colorTheme.text;

  return (
    <div className={`${cardBg} ${cardText} rounded-md p-1.5 md:p-2 text-[10px] md:text-xs`}>
      <div className="font-bold mb-0.5 md:mb-1 truncate">{staff.name}</div>
      {isEditMode ? (
        <ShiftDropdown value={editValue} onChange={onEditChange} />
      ) : (
        <ShiftDisplay staffShift={staffShift} staffId={staff.id} />
      )}
    </div>
  );
}

function ShiftDisplay({ staffShift, staffId }: { staffShift: DaySchedule['staffShifts'][string], staffId: string }) {
  const { shift } = staffShift;
  const barColor = BAR_COLORS[staffId] || 'bg-gray-500';

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
      <div className="flex items-center justify-between font-mono opacity-90 text-[9px] md:text-xs">
        <span>{shift.startTime}-{shift.endTime}</span>
        <span className="font-bold">({shift.workHours}h)</span>
      </div>
      {/* Timeline bar */}
      <div className="mt-0.5 md:mt-1 h-1 md:h-1.5 bg-gray-200 rounded-full relative overflow-hidden">
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
      </optgroup>
      <optgroup label="Actions">
         <option value="add_replacement">Add Replacement...</option>
      </optgroup>
      <optgroup label="Shifts">
        {Object.keys(SHIFT_DEFINITIONS).map(key => {
          const shift = SHIFT_DEFINITIONS[key];
          return <option key={key} value={key}>{`${shift.type} (${shift.startTime}-${shift.endTime})`}</option>
        })}
      </optgroup>
    </select>
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

function ReplacementCard({ replacement }: { replacement: ReplacementShift }) {
  return (
    <div className="bg-gray-200 border-l-4 border-gray-400 rounded-md p-1.5 md:p-2 text-[10px] md:text-xs text-gray-700">
      <div className="font-bold flex justify-between mb-0.5 md:mb-0">
        <span className="truncate">{replacement.tempStaffName}</span>
        <span className="text-gray-500 italic text-[9px] md:text-xs">Temp</span>
      </div>
      <div>
        {/* Time text row */}
        <div className="flex items-center justify-between font-mono opacity-90 text-[9px] md:text-xs">
          <span>{replacement.startTime}-{replacement.endTime}</span>
          <span className="font-bold">({replacement.workHours}h)</span>
        </div>
        {/* Timeline bar */}
        <div className="mt-0.5 md:mt-1 h-1 md:h-1.5 bg-gray-300 rounded-full relative overflow-hidden">
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

function Summaries({ weeklyHourSummaries, replacementShifts, monthlyHourTotals }: { 
  weeklyHourSummaries: WeeklyHourSummary[], 
  replacementShifts: (ReplacementShift & { date: Date })[], 
  monthlyHourTotals: { [staffId: string]: { totalActual: number; totalTarget: number; isUnderTarget: boolean } } 
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Weekly Hour Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {weeklyHourSummaries.sort((a,b) => a.week - b.week).map(s => (
            <div key={`${s.staffId}-${s.week}`} className={`text-sm p-2 rounded-md ${s.isUnderTarget ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              <span className="font-bold">{s.staffName}</span> (W{s.week}): <span className="font-mono">{s.actualHours}h / {s.targetHours}h</span>
            </div>
          ))}
        </div>
        
        {/* Monthly Totals Row */}
        {Object.keys(monthlyHourTotals).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold mb-2 text-gray-700">Monthly Totals</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(monthlyHourTotals).map(([staffId, totals]) => {
                const staff = STAFF_MEMBERS.find(s => s.id === staffId);
                if (!staff) return null; // Skip if not a permanent staff member
                return (
                  <div key={staffId} className={`text-sm p-2 rounded-md ${totals.isUnderTarget ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    <span className="font-bold">{staff.name}:</span> <span className="font-mono">{totals.totalActual}h / {totals.totalTarget}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {replacementShifts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
           <h3 className="text-lg font-semibold mb-2 text-gray-800">Temporary & Replacement Shifts</h3>
           <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
             {replacementShifts.map(r => (
               <li key={r.id}><strong>{format(r.date, 'EEE, MMM d')}:</strong> {r.tempStaffName} covered for {STAFF_MEMBERS.find(s => s.id === r.originalStaffId)?.name} ({r.workHours}h)</li>
             ))}
           </ul>
        </div>
      )}
    </div>
  )
}

// ================================================================================================
// Mobile View Components
// ================================================================================================

// Helper function for shift labels
function getShiftLabel(shift: ShiftDefinition | null): string {
  if (!shift) return 'Day Off';
  if (shift.type === '11h') return 'Full Day Shift';
  return shift.timing === 'early' ? 'Early Shift' : 'Late Shift';
}

interface MobileViewProps {
  schedule: MonthSchedule;
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
}

function MobileView({
  schedule,
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
}: MobileViewProps) {
  const selectedDay = schedule.days[selectedDayIndex];

  if (!selectedDay) return null;

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

  return (
    <div className="min-h-screen bg-gray-100 pb-28 font-sans">
      {/* Header */}
      <MobileHeader isAdmin={isAdmin} mode={mode} onLoginClick={onLoginClick} />

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
        {STAFF_MEMBERS.map(staff => (
          <MobileStaffCard
            key={staff.id}
            staff={staff}
            staffShift={selectedDay.staffShifts[staff.id]}
          />
        ))}
        {/* Replacement shifts */}
        {(selectedDay.replacementShifts || []).map(rep => (
          <MobileReplacementCard key={rep.id} replacement={rep} />
        ))}
      </div>

      {/* Bottom Day Selector with integrated TODAY button */}
      <MobileDaySelector
        days={schedule.days}
        selectedIndex={selectedDayIndex}
        onSelect={handleDateSelect}
        onGoToToday={onGoToToday}
      />
    </div>
  );
}

function MobileHeader({ isAdmin, mode, onLoginClick }: { isAdmin: boolean; mode: 'public' | 'admin'; onLoginClick: () => void }) {
  const { logout } = useAuth();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <h1 className="text-xl font-bold text-[#37352f]">Alde ST Timetable</h1>
      {mode === 'admin' || isAdmin ? (
        <button onClick={logout} className="p-2 text-[#91918e] hover:bg-[#f1f1ef] rounded-full transition-colors">
          <LogOut size={22} />
        </button>
      ) : (
        <button onClick={onLoginClick} className="p-2 text-[#91918e] hover:bg-[#f1f1ef] rounded-full transition-colors">
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

function MobileStaffCard({ staff, staffShift }: { staff: StaffMember; staffShift: DaySchedule['staffShifts'][string] }) {
  const avatarColors = AVATAR_COLORS[staff.id];
  const initials = staff.name.substring(0, 2).toUpperCase();
  const isOff = !staffShift.shift && !staffShift.isLeave;
  const isLeave = staffShift.isLeave;
  const isNotWorking = isOff || isLeave;

  // Determine shift label
  const shiftLabel = isOff
    ? 'Day Off'
    : isLeave
    ? `${staffShift.leaveType} Leave`
    : getShiftLabel(staffShift.shift);

  // Badge styling
  const badgeClasses = isNotWorking
    ? 'bg-gray-100 text-gray-600'
    : avatarColors.badge;

  // Card and avatar styling - grey out when not working
  const cardClasses = isNotWorking
    ? 'bg-gray-50 rounded-xl p-4 shadow-sm'
    : 'bg-white rounded-xl p-4 shadow-sm';
  const avatarBg = isNotWorking ? 'bg-gray-300' : avatarColors.bg;

  return (
    <div className={cardClasses}>
      {/* Top section: Avatar + Info + Badge */}
      <div className="flex items-center gap-3">
        {/* Smaller Avatar with border/shadow */}
        <div className={`w-10 h-10 ${avatarBg} rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-md`}>
          <span className="text-white font-bold text-xs">{initials}</span>
        </div>

        {/* Name and Shift Label */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{staff.name}</h3>
          <p className="text-sm text-gray-500">{shiftLabel}</p>
        </div>

        {/* Hours Badge - less rounded */}
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex-shrink-0 ${badgeClasses}`}>
          {isOff || isLeave ? (isLeave ? staffShift.leaveType : 'OFF') : `${staffShift.shift?.workHours}h`}
        </span>
      </div>

      {/* Progress Bar - full width, outside flex */}
      {staffShift.shift && (
        <>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${BAR_COLORS[staff.id]}`}
              style={{
                marginLeft: `${calculateBarStart(staffShift.shift.startTime)}%`,
                width: `${calculateBarWidth(staffShift.shift.startTime, staffShift.shift.endTime)}%`
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
            <Clock size={14} />
            <span>{staffShift.shift.startTime} - {staffShift.shift.endTime}</span>
          </div>
        </>
      )}

      {/* Not Scheduled (if off or leave) */}
      {(isOff || isLeave) && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-400">
          <CalendarIcon size={14} />
          <span className="italic">{isLeave ? `On ${staffShift.leaveType} leave` : 'Not scheduled'}</span>
        </div>
      )}
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

function MobileDaySelector({
  days,
  selectedIndex,
  onSelect,
  onGoToToday,
}: {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onGoToToday: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Auto-scroll to selected date
  useEffect(() => {
    if (selectedButtonRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = selectedButtonRef.current;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      // Calculate if button is out of view
      const isOutOfView = buttonRect.left < containerRect.left || buttonRect.right > containerRect.right;

      if (isOutOfView) {
        button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center">
        {/* Scrollable dates area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto px-3 py-3 scrollbar-hide"
        >
          <div className="flex gap-1">
            {days.map((day, idx) => {
              const isSelected = idx === selectedIndex;
              const isAdjacentMonth = !day.isCurrentMonth;
              const isToday = format(day.date, 'yyyy-MM-dd') === todayStr;

              // Determine button styling
              let buttonClasses = 'flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-colors';
              if (isSelected) {
                buttonClasses += ' bg-blue-500 text-white';
              } else if (isToday) {
                buttonClasses += ' bg-blue-100 text-blue-600';
              } else if (isAdjacentMonth) {
                buttonClasses += ' text-gray-300 hover:bg-gray-100';
              } else {
                buttonClasses += ' text-gray-500 hover:bg-gray-100';
              }

              return (
                <button
                  key={format(day.date, 'yyyy-MM-dd')}
                  ref={isSelected ? selectedButtonRef : null}
                  onClick={() => onSelect(idx)}
                  className={buttonClasses}
                >
                  <span className="text-xs font-semibold uppercase">{format(day.date, 'EEE')}</span>
                  <span className="text-xl font-bold">{format(day.date, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TODAY button - fixed on right */}
        <button
          onClick={onGoToToday}
          className="flex-shrink-0 flex flex-col items-center px-4 py-2 border-l border-gray-200 text-blue-500 hover:bg-gray-50 transition-colors"
        >
          <CalendarIcon size={20} />
          <span className="text-xs font-semibold mt-1">TODAY</span>
        </button>
      </div>
    </div>
  );
}

 