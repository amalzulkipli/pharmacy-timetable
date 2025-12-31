'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { generateMonthSchedule, getWeeklyHourSummaries, getMonthlyHourTotals, exportToCSV } from '../lib/schedule-generator';
import { STAFF_MEMBERS, SHIFT_DEFINITIONS, STAFF_COLORS } from '../staff-data';
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift, WeeklyHourSummary } from '../types/schedule';
import { format, getISOWeek, differenceInMinutes } from 'date-fns';
import { Download, Edit, Save, X, UserPlus, ChevronLeft, ChevronRight, User, LogOut, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useScheduleOverrides } from '../hooks/useLocalStorage';
import DataManager from './DataManager';


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
export default function Calendar() {
  const { isAdmin } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [schedule, setSchedule] = useState<MonthSchedule | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Record<string, Record<string, string>>>({});
  const { getOverridesForMonth, saveOverridesForMonth } = useScheduleOverrides();
  const [manualOverrides, setManualOverrides] = useState<Record<string, any>>({});
  
  // State for the replacement modal
  const [isReplacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacementContext, setReplacementContext] = useState<{ dayKey: string; staffId: string } | null>(null);

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
  useEffect(() => {
    // Load persisted overrides for the current month
    const persistedOverrides = getOverridesForMonth(selectedYear, selectedMonth);
    setManualOverrides(persistedOverrides);
  }, [selectedMonth, selectedYear, getOverridesForMonth]);

  useEffect(() => {
    const baseSchedule = generateMonthSchedule(selectedMonth, selectedYear);
    const updatedSchedule = applyManualOverrides(baseSchedule, manualOverrides);
    setSchedule(updatedSchedule);
  }, [selectedMonth, selectedYear, manualOverrides]);

  // Safety: Exit edit mode if user loses admin privileges
  useEffect(() => {
    if (!isAdmin && isEditMode) {
      setIsEditMode(false);
    }
  }, [isAdmin, isEditMode]);

  const applyManualOverrides = (baseSchedule: MonthSchedule, overrides: Record<string, any>): MonthSchedule => {
    const updatedDays = baseSchedule.days.map(day => {
      const dayKey = format(day.date, 'yyyy-MM-dd');
      let finalDay = { ...day, staffShifts: { ...day.staffShifts }, replacementShifts: day.replacementShifts ? [...day.replacementShifts] : [] };

      if (!overrides[dayKey]) return day;

      Object.keys(overrides[dayKey]).forEach(staffIdOrAction => {
        if (staffIdOrAction === 'replacements') {
          finalDay.replacementShifts = overrides[dayKey].replacements;
        } else {
          const staffId = staffIdOrAction;
          const override = overrides[dayKey][staffId];
          finalDay.staffShifts[staffId] = {
            ...finalDay.staffShifts[staffId],
            shift: override.shift,
            isLeave: override.isLeave,
            leaveType: override.leaveType,
            isOverride: true,
          };
        }
      });
      return finalDay;
    });
    return { ...baseSchedule, days: updatedDays };
  };

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
  
  const handleSaveChanges = () => {
    const newOverrides = { ...manualOverrides };
    Object.keys(editBuffer).forEach(dayKey => {
      if (!newOverrides[dayKey]) newOverrides[dayKey] = {};
      Object.keys(editBuffer[dayKey]).forEach(staffId => {
        const value = editBuffer[dayKey][staffId];
        if(value === 'add_replacement') return;

        let newShift: ShiftDefinition | null = null;
        let isLeave = false;
        let leaveType: 'AL' | 'RL' | 'EL' | undefined = undefined;

        if (value.startsWith('leave')) {
          isLeave = true;
          leaveType = value.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL';
        } else if (value !== 'off') {
          newShift = SHIFT_DEFINITIONS[value];
        }
        
        newOverrides[dayKey][staffId] = { shift: newShift, isLeave, leaveType };
      });
    });
    setManualOverrides(newOverrides);
    // Save overrides to localStorage for the current month
    saveOverridesForMonth(selectedYear, selectedMonth, newOverrides);
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

  const handleSaveReplacement = (name: string, start: string, end: string, breakHours: string) => {
    if (!replacementContext || !name) return;

    const { dayKey, staffId } = replacementContext;

    const newOverrides = { ...manualOverrides };
    if (!newOverrides[dayKey]) newOverrides[dayKey] = {};

    // Set original staff to off
    newOverrides[dayKey][staffId] = { shift: null, isLeave: false };
    
    // Add replacement shift
    if (!newOverrides[dayKey].replacements) newOverrides[dayKey].replacements = [];
    
    const startDate = new Date(`${dayKey}T${start}`);
    const endDate = new Date(`${dayKey}T${end}`);
    const shiftDuration = differenceInMinutes(endDate, startDate) / 60; // Duration in hours
    const finalWorkHours = shiftDuration - parseFloat(breakHours); // Subtract break time

    newOverrides[dayKey].replacements.push({
      id: `rep-${Date.now()}`,
      originalStaffId: staffId,
      tempStaffName: name,
      startTime: start,
      endTime: end,
      workHours: finalWorkHours > 0 ? finalWorkHours : 0,
    });

    setManualOverrides(newOverrides);
    // Save overrides to localStorage for the current month
    saveOverridesForMonth(selectedYear, selectedMonth, newOverrides);
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
          } catch (e) {
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

  if (!schedule) return <div className="p-8 text-center">Loading Schedule...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-screen-2xl mx-auto">
        <Header
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          isEditMode={isEditMode}
          isAdmin={isAdmin}
          onEnterEditMode={handleEnterEditMode}
          onSaveChanges={handleSaveChanges}
          onCancelEdit={() => setIsEditMode(false)}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPDF={handleDownloadPDF}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />

        <div id="calendar-container" className="bg-white rounded-lg shadow-md">
          <div className="calendar-grid">
            {DAYS.map(day => <div key={day} className="p-2 text-center font-bold text-gray-600 bg-gray-200 border-l border-gray-300">{day}</div>)}
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

        <Summaries weeklyHourSummaries={weeklyHourSummaries} replacementShifts={allReplacementShifts} monthlyHourTotals={monthlyHourTotals} />

        <Alerts schedule={schedule} weeklyHourSummaries={weeklyHourSummaries} isAdmin={isAdmin} />

        <DataManager isAdmin={isAdmin} />

        {isReplacementModalOpen && (
          <ReplacementModal 
            context={replacementContext}
            onClose={() => setReplacementModalOpen(false)}
            onSave={handleSaveReplacement}
          />
        )}
      </div>
    </div>
  );
}

// ================================================================================================
// Sub-Components for a Cleaner Structure
// ================================================================================================

function Header({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, isEditMode, isAdmin, onEnterEditMode, onSaveChanges, onCancelEdit, onDownloadCSV, onDownloadPDF, onPrevMonth, onNextMonth, onToday }: {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  isEditMode: boolean;
  isAdmin: boolean;
  onEnterEditMode: () => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const { logout, switchToPublic, openLoginModal } = useAuth();

  return (
    <div className="mb-6">
      {/* Row 1: Title */}
      <div className="mb-5">
        <h1 className="text-[28px] font-bold text-[#37352f] tracking-tight">Alde ST Timetable</h1>
      </div>

      {/* Row 2: Month/Year and Navigation */}
      <div className="flex items-center justify-between">
        {/* Left: Month/Year */}
        <div className="flex items-center">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded px-2 py-1 -ml-2 focus:outline-none"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-[15px] font-medium text-[#37352f] bg-transparent border-none cursor-pointer hover:bg-[#f1f1ef] rounded px-2 py-1 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Right: Navigation + Login/Admin buttons */}
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <div className="inline-flex items-center">
            <button
              onClick={onPrevMonth}
              className="p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={onToday}
              className="px-3 py-1 text-[#37352f] hover:bg-[#f1f1ef] rounded transition-colors text-[14px]"
            >
              Today
            </button>
            <button
              onClick={onNextMonth}
              className="p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Login button (when not admin) */}
          {!isAdmin && (
            <button onClick={openLoginModal} className="p-1.5 text-[#91918e] hover:bg-[#f1f1ef] rounded transition-colors">
              <User size={18} />
            </button>
          )}

          {/* Admin buttons */}
          {isAdmin && (
            <>
              <div className="w-px h-4 bg-[#e3e2e0] mx-1" />
              {isEditMode ? (
                <>
                  <button onClick={onSaveChanges} className="text-[14px] text-white bg-[#2383e2] hover:bg-[#0b6bcb] px-3 py-1 rounded transition-colors flex items-center gap-1.5"><Save size={14}/> Save</button>
                  <button onClick={onCancelEdit} className="text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-3 py-1 rounded transition-colors flex items-center gap-1"><X size={14}/> Cancel</button>
                </>
              ) : (
                <button onClick={onEnterEditMode} className="text-[14px] text-white bg-[#2383e2] hover:bg-[#0b6bcb] px-3 py-1 rounded transition-colors flex items-center gap-1.5"><Edit size={14}/> Edit</button>
              )}
              <button onClick={onDownloadCSV} className="text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-2 py-1 rounded transition-colors"><Download size={14}/></button>
              <button onClick={onDownloadPDF} className="text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-2 py-1 rounded transition-colors">PDF</button>
              <div className="w-px h-4 bg-[#e3e2e0] mx-1" />
              <button onClick={switchToPublic} className="text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-2 py-1 rounded transition-colors flex items-center gap-1"><Eye size={14}/></button>
              <button onClick={logout} className="text-[14px] text-[#91918e] hover:bg-[#f1f1ef] px-2 py-1 rounded transition-colors"><LogOut size={14}/></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Alerts({ schedule, weeklyHourSummaries, isAdmin }: { schedule: MonthSchedule, weeklyHourSummaries: any[], isAdmin: boolean }) {
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

function CalendarDay({ day, isEditMode, editBuffer, onEditBufferChange }: { day: DaySchedule, isEditMode: boolean, editBuffer: any, onEditBufferChange: any }) {
  const dayKey = format(day.date, 'yyyy-MM-dd');
  return (
    <div className={`border-t border-r border-gray-200 p-2 min-h-[200px] ${day.isHoliday ? 'bg-red-100' : day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-semibold text-sm ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}`}>{format(day.date, 'd')}</span>
        {day.isHoliday ? (
          <span className="text-xs text-red-600 font-medium truncate max-w-[80px]" title={day.holidayName}>{day.holidayName}</span>
        ) : (
          <span className="text-xs text-gray-500">W{getISOWeek(day.date)}</span>
        )}
      </div>
      <div className="space-y-2">
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
  return (
    <div className={`${colorTheme.bg} ${colorTheme.text} rounded-md p-2 text-xs`}>
      <div className="font-bold mb-1">{staff.name}</div>
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
        <div className="font-bold text-orange-600">{staffShift.leaveType}</div>
        {/* Empty placeholder for consistent height */}
        <div className="mt-1 h-1.5" />
      </div>
    );
  }

  // Off state
  if (!shift) {
    return (
      <div>
        <div className="text-gray-500">Off</div>
        {/* Empty placeholder for consistent height */}
        <div className="mt-1 h-1.5" />
      </div>
    );
  }

  // Working shift
  return (
    <div>
      {/* Time text row */}
      <div className="flex items-center justify-between font-mono opacity-90">
        <span>{shift.startTime}-{shift.endTime}</span>
        <span className="font-bold">({shift.workHours}h)</span>
      </div>
      {/* Timeline bar */}
      <div className="mt-1 h-1.5 bg-gray-200 rounded-full relative overflow-hidden">
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

function ReplacementModal({ context, onClose, onSave }: { context: any, onClose: () => void, onSave: (name: string, start: string, end: string, breakHours: string) => void}) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakHours, setBreakHours] = useState('1'); // Default break is 1 hour

  const staffName = context ? STAFF_MEMBERS.find(s => s.id === context.staffId)?.name : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="text-blue-600" />
          <h3 className="text-lg font-bold text-gray-800">Add Temporary Replacement</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">You are adding a replacement for <strong>{staffName}</strong> on <strong>{format(new Date(context.dayKey), 'EEE, MMM d')}</strong>. Their shift will be set to 'Off'.</p>
        <div className="space-y-4">
          <input type="text" placeholder="Temporary Staff Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500"/>
          <div className="flex gap-4">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500"/>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label htmlFor="break-hours" className="block text-sm font-medium text-gray-700 mt-4">Break (hours)</label>
            <input
              type="number"
              id="break-hours"
              value={breakHours}
              onChange={e => setBreakHours(e.target.value)}
              className="w-full p-2 border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 mt-1"
              step="0.5"
              min="0"
              placeholder="e.g., 1.5"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="w-full p-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
          <button onClick={() => onSave(name, startTime, endTime, breakHours)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Replacement</button>
        </div>
      </div>
    </div>
  )
}

function ReplacementCard({ replacement }: { replacement: ReplacementShift }) {
  return (
    <div className="bg-gray-200 border-l-4 border-gray-400 rounded-md p-2 text-xs text-gray-700">
      <div className="font-bold flex justify-between">
        <span>{replacement.tempStaffName}</span>
        <span className="text-gray-500 italic">Temp</span>
      </div>
      <div>
        {/* Time text row */}
        <div className="flex items-center justify-between font-mono opacity-90">
          <span>{replacement.startTime}-{replacement.endTime}</span>
          <span className="font-bold">({replacement.workHours}h)</span>
        </div>
        {/* Timeline bar */}
        <div className="mt-1 h-1.5 bg-gray-300 rounded-full relative overflow-hidden">
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