import { STAFF_MEMBERS, SHIFT_PATTERNS, DEFAULT_SHIFT_PATTERNS } from '../staff-data';
import type {
  MonthSchedule,
  DaySchedule,
  PublicHoliday,
  WeeklyHourSummary,
  ShiftDefinition,
  StaffMember
} from '../types/schedule';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, startOfWeek, endOfWeek, getISOWeek } from 'date-fns';
import type { DatabaseStaffMember } from '../hooks/useStaff';

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

// Helper function to get shift for a staff member on a given day
// Uses SHIFT_PATTERNS for legacy staff, DEFAULT_SHIFT_PATTERNS for new staff
function getShiftForStaff(
  staffId: string,
  role: string,
  dayOfWeek: number,
  patternIndex: number
): ShiftDefinition | null {
  // Check if this staff has a pattern in SHIFT_PATTERNS (legacy staff)
  const pattern = SHIFT_PATTERNS[patternIndex];
  if (pattern.dailyShifts[staffId]) {
    return pattern.dailyShifts[staffId][dayOfWeek] || null;
  }

  // Use DEFAULT_SHIFT_PATTERNS for new staff based on their role
  const defaultPattern = DEFAULT_SHIFT_PATTERNS[role];
  if (defaultPattern && defaultPattern[patternIndex]) {
    return defaultPattern[patternIndex][dayOfWeek] || null;
  }

  // Fallback: no shift (off day)
  return null;
}

export function generateMonthSchedule(
  month: number,
  year: number,
  staffMembers?: (StaffMember | DatabaseStaffMember)[]
): MonthSchedule {
  // Use provided staff list or fall back to legacy STAFF_MEMBERS
  const staffList = staffMembers ?? STAFF_MEMBERS;

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
    const holidayInfo = isHoliday(date);

    const staffShifts: { [staffId: string]: { shift: ShiftDefinition | null; isOverride: boolean; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' } } = {};

    // Filter staff who are active on this date
    const activeStaff = staffList.filter(staff => {
      // Check if staff has startDate (DatabaseStaffMember)
      const dbStaff = staff as DatabaseStaffMember;
      if (!dbStaff.startDate) return true; // No startDate means always active

      const staffStart = new Date(dbStaff.startDate);
      staffStart.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= staffStart;
    });

    activeStaff.forEach(staff => {
      if (holidayInfo.isHoliday) {
        // Block all staff on public holidays
        staffShifts[staff.id] = {
          shift: null,
          isOverride: false,
          isLeave: false,
        };
      } else {
        // Use pattern-based shift (from SHIFT_PATTERNS or DEFAULT_SHIFT_PATTERNS)
        const shift = getShiftForStaff(staff.id, staff.role, dayOfWeek, patternIndex);
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

  // Calculate weekly hours with the active staff list
  const weeklyHours = calculateWeeklyHours(days, staffList);

  return {
    month,
    year,
    days,
    weeklyHours,
  };
}

function calculateWeeklyHours(
  days: DaySchedule[],
  staffMembers?: (StaffMember | DatabaseStaffMember)[]
): { [staffId: string]: { [week: number]: number } } {
  const staffList = staffMembers ?? STAFF_MEMBERS;
  const weeklyHours: { [staffId: string]: { [week: number]: number } } = {};

  staffList.forEach(staff => {
    weeklyHours[staff.id] = {};
  });

  days.forEach(day => {
    const week = getISOWeek(day.date);

    // Only count hours for staff who have shifts on this day
    Object.keys(day.staffShifts).forEach(staffId => {
      if (!weeklyHours[staffId]) {
        weeklyHours[staffId] = {};
      }
      if (!weeklyHours[staffId][week]) {
        weeklyHours[staffId][week] = 0;
      }

      const staffShift = day.staffShifts[staffId];
      if (staffShift && staffShift.shift && !staffShift.isLeave) {
        weeklyHours[staffId][week] += staffShift.shift.workHours;
      }
    });
  });

  return weeklyHours;
}

export function getWeeklyHourSummaries(
  schedule: MonthSchedule,
  staffMembers?: (StaffMember | DatabaseStaffMember)[]
): WeeklyHourSummary[] {
  const staffList = staffMembers ?? STAFF_MEMBERS;
  const weeklyHours = calculateWeeklyHours(schedule.days, staffList);
  const summaries: WeeklyHourSummary[] = [];

  // Process permanent staff - only include staff that appear in CURRENT MONTH days
  // This ensures staff with future start dates don't show in summaries
  const staffIdsInCurrentMonth = new Set<string>();
  schedule.days
    .filter(day => day.isCurrentMonth)
    .forEach(day => {
      Object.keys(day.staffShifts).forEach(id => staffIdsInCurrentMonth.add(id));
    });

  staffList
    .filter(staff => staffIdsInCurrentMonth.has(staff.id))
    .forEach(staff => {
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

export function getMonthlyHourTotals(
  schedule: MonthSchedule,
  staffMembers?: (StaffMember | DatabaseStaffMember)[]
): { [staffId: string]: { totalActual: number; totalTarget: number; isUnderTarget: boolean } } {
  const staffList = staffMembers ?? STAFF_MEMBERS;
  const weeklyHours = calculateWeeklyHours(schedule.days, staffList);
  const totals: { [staffId: string]: { totalActual: number; totalTarget: number; isUnderTarget: boolean } } = {};

  // Get relevant weeks for the current month
  const relevantWeeks = new Set(schedule.days.filter(d => d.isCurrentMonth).map(d => getISOWeek(d.date)));
  const numberOfWeeks = relevantWeeks.size;

  // Get staff that appear in CURRENT MONTH days only
  // This ensures staff with future start dates don't show in summaries
  const staffIdsInCurrentMonth = new Set<string>();
  schedule.days
    .filter(day => day.isCurrentMonth)
    .forEach(day => {
      Object.keys(day.staffShifts).forEach(id => staffIdsInCurrentMonth.add(id));
    });

  // Calculate totals for permanent staff only
  staffList
    .filter(staff => staffIdsInCurrentMonth.has(staff.id))
    .forEach(staff => {
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

export function exportToCSV(
  schedule: MonthSchedule,
  staffMembers?: (StaffMember | DatabaseStaffMember)[]
): string {
  const staffList = staffMembers ?? STAFF_MEMBERS;
  const lines: string[] = [];

  // Build header dynamically based on staff
  const staffHeaders = staffList.map(s => {
    const prefix = s.role === 'Pharmacist' ? 'Ph ' : 'Staff ';
    return prefix + s.name;
  });
  lines.push(`Day,Month,Date,,${staffHeaders.join(',')},Note`);

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

    staffList.forEach(staff => {
      const staffShift = day.staffShifts[staff.id];
      let cellValue = '';

      if (!staffShift) {
        // Staff not active on this date
        cellValue = '-';
      } else if (day.isHoliday) {
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
        const originalStaff = staffList.find(s => s.id === replacement.originalStaffId);
        if (originalStaff) {
          // Find the column index for the original staff member
          const staffIndex = staffList.findIndex(s => s.id === replacement.originalStaffId);
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