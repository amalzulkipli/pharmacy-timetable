'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { generateMonthSchedule, getWeeklyHourSummaries, exportToCSV } from '../lib/schedule-generator';
import { STAFF_MEMBERS, SHIFT_DEFINITIONS, STAFF_COLORS } from '../staff-data';
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift } from '../types/schedule';
import { format, getISOWeek, differenceInMinutes } from 'date-fns';
import { Download, Calendar as CalendarIcon, Edit, Save, X, Clock, ArrowRight, UserPlus } from 'lucide-react';


const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ================================================================================================
// Main Calendar Component
// ================================================================================================
export default function Calendar() {
  const [selectedMonth, setSelectedMonth] = useState(7);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [schedule, setSchedule] = useState<MonthSchedule | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Record<string, Record<string, string>>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<string, any>>({});
  
  // State for the replacement modal
  const [isReplacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacementContext, setReplacementContext] = useState<{ dayKey: string; staffId: string } | null>(null);



  // --- Core Logic ---
  useEffect(() => {
    const baseSchedule = generateMonthSchedule(selectedMonth, selectedYear);
    const updatedSchedule = applyManualOverrides(baseSchedule, manualOverrides);
    setSchedule(updatedSchedule);
  }, [selectedMonth, selectedYear, manualOverrides]);

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
        if (isLeave) key = `leave_${leaveType?.toLowerCase()}`;
        else if (shift) key = Object.keys(SHIFT_DEFINITIONS).find(k => SHIFT_DEFINITIONS[k] === shift) || 'off';
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

      console.log('✅ Schedule found, generating paginated PDF...');

      // Create title and filename
      const monthName = MONTHS[selectedMonth - 1];
      const title = `Timetable ${monthName} ${selectedYear}`;
      const filename = `Timetable-${monthName}-${selectedYear}.pdf`;

      // Group schedule days by weeks (2 weeks per page)
      const weekGroups = groupDaysByWeeks(schedule.days, 2);

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

      // Generate HTML content with multiple pages
      const pagesHtml = weekGroups.map((weekGroup, pageIndex) => {
        const pageTitle = pageIndex === 0 ? title : '';
        return generatePageHtml(weekGroup, pageTitle, pageIndex === weekGroups.length - 1);
      }).join('\n');

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
            ${pagesHtml}
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

  // Helper function to group days by weeks
  const groupDaysByWeeks = (days: DaySchedule[], weeksPerPage: number) => {
    const weeks: DaySchedule[][] = [];
    let currentWeek: DaySchedule[] = [];
    let currentWeekNumber = -1;

    days.forEach(day => {
      const weekNumber = getISOWeek(day.date);
      
      if (weekNumber !== currentWeekNumber) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
        }
        currentWeek = [day];
        currentWeekNumber = weekNumber;
      } else {
        currentWeek.push(day);
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Group weeks into pages
    const pages: DaySchedule[][] = [];
    for (let i = 0; i < weeks.length; i += weeksPerPage) {
      const pageWeeks = weeks.slice(i, i + weeksPerPage);
      pages.push(pageWeeks.flat());
    }

    return pages;
  };

  // Helper function to generate HTML for a single page
  const generatePageHtml = (days: DaySchedule[], pageTitle: string, isLastPage: boolean) => {
    const pageClass = isLastPage ? 'pdf-page' : 'pdf-page';
    
    return `
      <div class="${pageClass}">
        ${pageTitle ? `<h1 style="text-align: center; font-size: 24px; font-weight: bold; margin: 0 0 20px 0; color: #1f2937;">${pageTitle}</h1>` : ''}
        <div class="overflow-x-auto bg-white rounded-lg shadow-md">
          <div class="grid grid-cols-7 min-w-[1400px]">
            ${DAYS.map(day => `<div class="p-2 text-center font-bold text-gray-600 bg-gray-200 border-l border-gray-300">${day}</div>`).join('')}
            ${days.map(day => generateDayHtml(day)).join('')}
          </div>
        </div>
      </div>
    `;
  };

  // Helper function to generate HTML for a single day
  const generateDayHtml = (day: DaySchedule) => {
    const dayKey = format(day.date, 'yyyy-MM-dd');
    const dayClasses = `border-t border-r border-gray-200 p-2 min-h-[200px] ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'} ${day.isHoliday ? 'bg-red-50' : ''}`;
    
    const staffCards = STAFF_MEMBERS.map(staff => {
      const staffShift = day.staffShifts[staff.id];
      const colorTheme = STAFF_COLORS[staff.id];
      

      
      return `
        <div class="${colorTheme.bg} ${colorTheme.text} ${colorTheme.border} border-l-4 rounded-md p-2 text-xs mb-2">
          <div class="font-bold mb-1">${staff.name}</div>
          ${generateShiftDisplayHtml(staffShift)}
        </div>
      `;
    }).join('');

    const replacementCards = (day.replacementShifts || []).map(rep => `
      <div class="bg-gray-200 border-l-4 border-gray-400 rounded-md p-2 text-xs text-gray-700 mb-2">
        <div class="font-bold flex justify-between">
          <span>${rep.tempStaffName}</span> 
          <span class="text-gray-500 italic">Temp</span>
        </div>
        <div class="flex items-center justify-between font-mono opacity-90">
          <div class="flex items-center gap-1">${rep.startTime} → ${rep.endTime}</div>
          <div class="font-bold">(${rep.workHours}h)</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="${dayClasses}">
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold text-sm ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}">${format(day.date, 'd')}</span>
          <span class="text-xs text-gray-500">W${getISOWeek(day.date)}</span>
        </div>
        <div>
          ${staffCards}
          ${replacementCards}
        </div>
      </div>
    `;
  };

  // Helper function to generate shift display HTML
  const generateShiftDisplayHtml = (staffShift: DaySchedule['staffShifts'][string]) => {
    if (staffShift.isLeave) {
      return `<div class="font-bold text-orange-600">${staffShift.leaveType}</div>`;
    }
    if (!staffShift.shift) {
      return `<div class="text-gray-500">Off</div>`;
    }
    
    const { shift } = staffShift;
    return `
      <div class="flex items-center justify-between font-mono opacity-90">
        <div class="flex items-center gap-1">⏰ ${shift.startTime} → ${shift.endTime}</div>
        <div class="font-bold">(${shift.workHours}h)</div>
        ${staffShift.isOverride ? '<span title="Manually Overridden">✏️</span>' : ''}
      </div>
    `;
  };

  // --- Memoized Calculations for Performance ---
  const weeklyHourSummaries = useMemo(() => schedule ? getWeeklyHourSummaries(schedule) : [], [schedule]);
  const allReplacementShifts = useMemo(() => schedule ? schedule.days.flatMap(d => (d.replacementShifts || []).map(r => ({...r, date: d.date}))) : [], [schedule]);

  if (!schedule) return <div className="p-8 text-center">Loading Schedule...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-screen-2xl mx-auto">
        <Header 
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          isEditMode={isEditMode}
          onEnterEditMode={handleEnterEditMode}
          onSaveChanges={handleSaveChanges}
          onCancelEdit={() => setIsEditMode(false)}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPDF={handleDownloadPDF}
        />
        
        <Alerts schedule={schedule} weeklyHourSummaries={weeklyHourSummaries} />

        <div id="calendar-container" className="overflow-x-auto bg-white rounded-lg shadow-md">
          <div className="grid grid-cols-7 min-w-[1400px]">
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
        
        <Summaries weeklyHourSummaries={weeklyHourSummaries} replacementShifts={allReplacementShifts} />

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

function Header({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, isEditMode, onEnterEditMode, onSaveChanges, onCancelEdit, onDownloadCSV, onDownloadPDF }: {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  isEditMode: boolean;
  onEnterEditMode: () => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CalendarIcon className="text-blue-600"/> Pharmacy Timetable</h1>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-gray-50 border-gray-300 text-gray-900 rounded-md px-3 py-2 font-semibold hover:bg-gray-100 focus:ring-2 focus:ring-blue-500">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-gray-50 border-gray-300 text-gray-900 rounded-md px-3 py-2 font-semibold hover:bg-gray-100 focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button onClick={onSaveChanges} className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold hover:bg-green-700 transition-colors"><Save size={16}/> Save</button>
              <button onClick={onCancelEdit} className="bg-gray-500 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold hover:bg-gray-600 transition-colors"><X size={16}/> Cancel</button>
            </>
          ) : (
            <button onClick={onEnterEditMode} className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold hover:bg-blue-700 transition-colors"><Edit size={16}/> Edit</button>
          )}
          
          {/* Download Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onDownloadCSV}
              className="bg-gray-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold hover:bg-gray-800 transition-colors"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={onDownloadPDF}
              className="bg-gray-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold hover:bg-gray-800 transition-colors"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alerts({ schedule, weeklyHourSummaries }: { schedule: MonthSchedule, weeklyHourSummaries: any[] }) {
  const holidayAlerts = schedule.days.filter(d => d.isHoliday && d.isCurrentMonth);
  const hourWarnings = weeklyHourSummaries.filter(s => s.isUnderTarget);

  if (holidayAlerts.length === 0 && hourWarnings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {hourWarnings.length > 0 && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 rounded-md text-sm"><b>Hour Warnings:</b> {hourWarnings.map(w => `${w.staffName} (W${w.week}: ${w.actualHours}/${w.targetHours}h)`).join(', ')}</div>}
      {holidayAlerts.length > 0 && <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-3 rounded-md text-sm"><b>Holidays:</b> {holidayAlerts.map(h => `${format(h.date, 'MMM d')}: ${h.holidayName}`).join(', ')}</div>}
    </div>
  )
}

function CalendarDay({ day, isEditMode, editBuffer, onEditBufferChange }: { day: DaySchedule, isEditMode: boolean, editBuffer: any, onEditBufferChange: any }) {
  const dayKey = format(day.date, 'yyyy-MM-dd');
  return (
    <div className={`border-t border-r border-gray-200 p-2 min-h-[200px] ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'} ${day.isHoliday ? 'bg-red-50' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-semibold text-sm ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}`}>{format(day.date, 'd')}</span>
        <span className="text-xs text-gray-500">W{getISOWeek(day.date)}</span>
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

function StaffCard({ staff, day, isEditMode, editValue, onEditChange }: { staff: StaffMember, day: DaySchedule, isEditMode: boolean, editValue: string, onEditChange: (value: string) => void}) {
  const staffShift = day.staffShifts[staff.id];
  const colorTheme = STAFF_COLORS[staff.id];
  return (
    <div className={`${colorTheme.bg} ${colorTheme.text} ${colorTheme.border} border-l-4 rounded-md p-2 text-xs`}>
      <div className="font-bold mb-1">{staff.name}</div>
      {isEditMode ? (
        <ShiftDropdown value={editValue} onChange={onEditChange} />
      ) : (
        <ShiftDisplay staffShift={staffShift} />
      )}
    </div>
  );
}

function ShiftDisplay({ staffShift }: { staffShift: DaySchedule['staffShifts'][string] }) {
  if (staffShift.isLeave) return <div className="font-bold text-orange-600">{staffShift.leaveType}</div>;
  if (!staffShift.shift) return <div className="text-gray-500">Off</div>;
  
  const { shift } = staffShift;
  return (
    <div className="flex items-center justify-between font-mono opacity-90">
      <div className="flex items-center gap-1"><Clock size={12} /> {shift.startTime} <ArrowRight size={12} /> {shift.endTime}</div>
      <div className="font-bold">({shift.workHours}h)</div>
      {staffShift.isOverride && <span title="Manually Overridden"><Edit size={12} className="text-blue-600"/></span>}
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
      <div className="flex items-center justify-between font-mono opacity-90">
        <div className="flex items-center gap-1"><Clock size={12} /> {replacement.startTime} <ArrowRight size={12} /> {replacement.endTime}</div>
        <div className="font-bold">({replacement.workHours}h)</div>
      </div>
    </div>
  )
}

function Summaries({ weeklyHourSummaries, replacementShifts }: { weeklyHourSummaries: any[], replacementShifts: any[] }) {
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