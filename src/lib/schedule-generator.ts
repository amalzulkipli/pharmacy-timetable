import { STAFF_MEMBERS, SHIFT_PATTERNS } from '../staff-data';
import type { 
  MonthSchedule, 
  DaySchedule, 
  StaffMember, 
  PublicHoliday,
  WeeklyHourSummary 
} from '../types/schedule';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, startOfWeek, endOfWeek, getISOWeek } from 'date-fns';

// Company public holidays
export const PUBLIC_HOLIDAYS: PublicHoliday[] = [
  // 2025
  { date: '2025-03-31', name: 'Raya Puasa 1' },
  { date: '2025-04-01', name: 'Raya Puasa 2' },
  { date: '2025-04-02', name: 'Raya Puasa 3 (*ganti Nuzul Quran)' },
  { date: '2025-05-01', name: 'Labour Day' },
  { date: '2025-06-02', name: 'Agong Birthday' },
  { date: '2025-06-07', name: 'Hari Raya Haji Day 1' },
  { date: '2025-06-08', name: 'Hari raya Haji Day 2 (*ganti Maulidur Rasul)' },
  { date: '2025-06-27', name: 'Awal Muharam' },
  { date: '2025-08-31', name: 'Merdeka Day' },
  { date: '2025-09-06', name: 'Cuti AM (*Ganti Cuti PMX Bagi)' },
  { date: '2025-09-16', name: 'Hari Malaysia' },
  { date: '2025-12-11', name: 'Sultan Selangor\'s Birthday' },
  // 2026
  { date: '2026-03-21', name: 'Hari Raya Aidilfitri' },
  { date: '2026-03-22', name: 'Hari Raya Aidilfitri' },
  { date: '2026-03-23', name: 'Hari Raya Aidilfitri' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-27', name: 'Hari Raya Aidiladha (Haji)' },
  { date: '2026-05-28', name: 'Hari Raya Aidiladha (Haji)' },
  { date: '2026-06-01', name: 'Agong Birthday' },
  { date: '2026-06-17', name: 'Awal Muharram (Maal Hijrah)' },
  { date: '2026-08-31', name: 'National Day (Merdeka)' },
  { date: '2026-09-16', name: 'Malaysia Day' },
  { date: '2026-12-11', name: 'Sultan of Selangor\'s Birthday' },
];

function getPatternForWeek(isoWeek: number): number {
  // Pattern 0 for odd ISO weeks, Pattern 1 for even ISO weeks
  return isoWeek % 2 === 1 ? 0 : 1;
}

function isHoliday(date: Date): { isHoliday: boolean; holidayName?: string } {
  const dateStr = format(date, 'yyyy-MM-dd');
  const holiday = PUBLIC_HOLIDAYS.find(h => h.date === dateStr);
  return {
    isHoliday: !!holiday,
    holidayName: holiday?.name
  };
}

export function generateMonthSchedule(month: number, year: number): MonthSchedule {
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(new Date(year, month - 1));
  
  // Extend to show full weeks (Monday start)
  const startDate = startOfWeek(firstDay, { weekStartsOn: 1 });
  const endDate = endOfWeek(lastDay, { weekStartsOn: 1 });
  
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  const days: DaySchedule[] = allDays.map(date => {
    const dayOfWeek = getDay(date);
    const isoWeek = getISOWeek(date);
    const patternIndex = getPatternForWeek(isoWeek);
    const pattern = SHIFT_PATTERNS[patternIndex];
    const holidayInfo = isHoliday(date);
    
    const staffShifts: { [staffId: string]: any } = {};
    
    STAFF_MEMBERS.forEach(staff => {
      if (holidayInfo.isHoliday) {
        // Block all staff on public holidays
        staffShifts[staff.id] = {
          shift: null,
          isOverride: false,
          isLeave: false,
        };
      } else {
        // Use pattern-based shift
        const shift = pattern.dailyShifts[staff.id][dayOfWeek] || null;
        staffShifts[staff.id] = {
          shift,
          isOverride: false,
          isLeave: false,
        };
      }
    });
    
    return {
      date,
      dayOfWeek,
      isHoliday: holidayInfo.isHoliday,
      holidayName: holidayInfo.holidayName,
      isCurrentMonth: date.getMonth() === month - 1,
      staffShifts,
    };
  });
  
  // Calculate weekly hours
  const weeklyHours = calculateWeeklyHours(days);
  
  return {
    month,
    year,
    days,
    weeklyHours,
  };
}

function calculateWeeklyHours(days: DaySchedule[]): { [staffId: string]: { [week: number]: number } } {
  const weeklyHours: { [staffId: string]: { [week: number]: number } } = {};
  
  STAFF_MEMBERS.forEach(staff => {
    weeklyHours[staff.id] = {};
  });
  
  days.forEach(day => {
    const week = getISOWeek(day.date);
    
    STAFF_MEMBERS.forEach(staff => {
      if (!weeklyHours[staff.id][week]) {
        weeklyHours[staff.id][week] = 0;
      }
      
      const staffShift = day.staffShifts[staff.id];
      if (staffShift.shift && !staffShift.isLeave) {
        weeklyHours[staff.id][week] += staffShift.shift.workHours;
      }
    });
  });
  
  return weeklyHours;
}

export function getWeeklyHourSummaries(schedule: MonthSchedule): WeeklyHourSummary[] {
  const weeklyHours = calculateWeeklyHours(schedule.days);
  const summaries: WeeklyHourSummary[] = [];

  // Process permanent staff
  STAFF_MEMBERS.forEach(staff => {
    const staffWeeks = weeklyHours[staff.id] || {};
    const relevantWeeks = new Set(schedule.days.filter(d => d.isCurrentMonth).map(d => getISOWeek(d.date)));
    
    relevantWeeks.forEach(week => {
      summaries.push({
        staffId: staff.id,
        staffName: staff.name,
        targetHours: staff.weeklyHours,
        actualHours: staffWeeks[week] || 0,
        isUnderTarget: (staffWeeks[week] || 0) < staff.weeklyHours,
        week,
      });
    });
  });

  // Process replacement staff
  const replacementHoursByWeek: { [week: number]: { [name: string]: number } } = {};
  schedule.days.forEach(day => {
    if (day.replacementShifts) {
      const week = getISOWeek(day.date);
      if (!replacementHoursByWeek[week]) replacementHoursByWeek[week] = {};
      
      day.replacementShifts.forEach(rep => {
        if (!replacementHoursByWeek[week][rep.tempStaffName]) {
          replacementHoursByWeek[week][rep.tempStaffName] = 0;
        }
        replacementHoursByWeek[week][rep.tempStaffName] += rep.workHours;
      });
    }
  });

  Object.entries(replacementHoursByWeek).forEach(([weekStr, names]) => {
    const week = parseInt(weekStr);
    Object.entries(names).forEach(([name, hours]) => {
      summaries.push({
        staffId: `temp-${name}`,
        staffName: `${name} (Temp)`,
        targetHours: 0, // Temps have no target hours
        actualHours: hours,
        isUnderTarget: false,
        week,
      });
    });
  });

  return summaries;
}

export function getMonthlyHourTotals(schedule: MonthSchedule): { [staffId: string]: { totalActual: number; totalTarget: number; isUnderTarget: boolean } } {
  const weeklyHours = calculateWeeklyHours(schedule.days);
  const totals: { [staffId: string]: { totalActual: number; totalTarget: number; isUnderTarget: boolean } } = {};

  // Get relevant weeks for the current month
  const relevantWeeks = new Set(schedule.days.filter(d => d.isCurrentMonth).map(d => getISOWeek(d.date)));
  const numberOfWeeks = relevantWeeks.size;

  // Calculate totals for permanent staff only
  STAFF_MEMBERS.forEach(staff => {
    const staffWeeks = weeklyHours[staff.id] || {};
    let totalActual = 0;
    
    // Sum up actual hours across all weeks
    relevantWeeks.forEach(week => {
      totalActual += staffWeeks[week] || 0;
    });
    
    // Calculate target hours for the month (weekly target * number of weeks)
    const totalTarget = staff.weeklyHours * numberOfWeeks;
    
    totals[staff.id] = {
      totalActual,
      totalTarget,
      isUnderTarget: totalActual < totalTarget,
    };
  });

  return totals;
}

export function exportToCSV(schedule: MonthSchedule): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Day,Month,Date,,Fatimah,Staff Siti,Staff Pah,Ph Amal,Note');
  
  schedule.days.forEach(day => {
    if (!day.isCurrentMonth) return; // Only export current month days
    
    const dayName = format(day.date, 'EEE');
    const monthName = format(day.date, 'MMM');
    const dateNum = format(day.date, 'd');
    
    const staffColumns: string[] = [];
    const notes: string[] = [];
    
    // Add holiday note if applicable
    if (day.isHoliday && day.holidayName) {
      notes.push(day.holidayName);
    }
    
    STAFF_MEMBERS.forEach(staff => {
      const staffShift = day.staffShifts[staff.id];
      let cellValue = '';
      
      if (day.isHoliday) {
        cellValue = 'PH';
      } else if (staffShift.isLeave) {
        cellValue = staffShift.leaveType || 'AL';
      } else if (!staffShift.shift) {
        cellValue = 'Off';
      } else {
        const shift = staffShift.shift;
        const rolePrefix = staff.role === 'Pharmacist' ? 'Ph ' : '';
        cellValue = `${rolePrefix}${shift.startTime} - ${shift.endTime} (${shift.workHours} hours)`;
      }
      
      staffColumns.push(cellValue);
    });
    
    // Handle replacement shifts
    if (day.replacementShifts && day.replacementShifts.length > 0) {
      day.replacementShifts.forEach(replacement => {
        const originalStaff = STAFF_MEMBERS.find(s => s.id === replacement.originalStaffId);
        if (originalStaff) {
          // Find the column index for the original staff member
          const staffIndex = STAFF_MEMBERS.findIndex(s => s.id === replacement.originalStaffId);
          if (staffIndex !== -1) {
            // Set the original staff to "Off"
            staffColumns[staffIndex] = 'Off';
          }
          
          // Add replacement note
          notes.push(`Covered by ${replacement.tempStaffName} (${replacement.startTime}-${replacement.endTime}, ${replacement.workHours}h)`);
        }
      });
    }
    
    const noteColumn = notes.join('; ');
    lines.push(`${dayName},${monthName},${dateNum},,${staffColumns.join(',')},${noteColumn}`);
  });
  
  return lines.join('\n');
} 