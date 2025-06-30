export interface StaffMember {
  id: string;
  name: string;
  role: 'Pharmacist' | 'Assistant Pharmacist';
  weeklyHours: number;
  defaultOffDays: number[]; // Days of week (0=Sunday, 6=Saturday)
}

export interface ShiftDefinition {
  type: string;
  timing: 'early' | 'late' | null;
  startTime: string;
  endTime: string;
  workHours: number;
}

export interface ShiftPattern {
  patternId: number;
  dailyShifts: {
    [staffId: string]: {
      [dayOfWeek: number]: ShiftDefinition | null;
    };
  };
}

export interface DaySchedule {
  date: Date;
  dayOfWeek: number;
  isHoliday: boolean;
  holidayName?: string;
  isCurrentMonth: boolean;
  staffShifts: {
    [staffId: string]: {
      shift: ShiftDefinition | null;
      isOverride: boolean;
      isLeave: boolean;
      leaveType?: 'AL' | 'RL' | 'EL';
    };
  };
  replacementShifts?: ReplacementShift[];
}

export interface ReplacementShift {
  id: string; // Unique ID for the replacement shift
  originalStaffId: string;
  tempStaffName: string;
  startTime: string;
  endTime: string;
  workHours: number;
}

export interface MonthSchedule {
  month: number;
  year: number;
  days: DaySchedule[];
  weeklyHours: {
    [staffId: string]: {
      [week: number]: number;
    };
  };
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface WeeklyHourSummary {
  staffId: string;
  staffName: string;
  targetHours: number;
  actualHours: number;
  isUnderTarget: boolean;
  week: number;
} 