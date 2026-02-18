import type { StaffMember, ShiftDefinition, ShiftPattern } from "@/types/schedule"

// ============================================
// EXTENDED COLOR SYSTEM
// ============================================

// Extended color palette for dynamic staff assignment
// Index 0-3: Legacy staff colors (fatimah, siti, pah, amal)
// Index 4+: Colors for new staff members
export const STAFF_COLOR_PALETTE = [
  // Index 0: Blue (fatimah)
  { card: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-400' }, avatar: { bg: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' }, bar: 'bg-blue-500', hex: '#3b82f6' },
  // Index 1: Green (siti)
  { card: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-400' }, avatar: { bg: 'bg-green-500', badge: 'bg-green-100 text-green-700' }, bar: 'bg-green-500', hex: '#22c55e' },
  // Index 2: Purple (pah)
  { card: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-400' }, avatar: { bg: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' }, bar: 'bg-purple-500', hex: '#a855f7' },
  // Index 3: Pink (amal)
  { card: { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-400' }, avatar: { bg: 'bg-pink-500', badge: 'bg-pink-100 text-pink-700' }, bar: 'bg-pink-500', hex: '#ec4899' },
  // Index 4: Orange (new staff)
  { card: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-400' }, avatar: { bg: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' }, bar: 'bg-orange-500', hex: '#f97316' },
  // Index 5: Teal (new staff)
  { card: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-400' }, avatar: { bg: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700' }, bar: 'bg-teal-500', hex: '#14b8a6' },
  // Index 6: Indigo (new staff)
  { card: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-400' }, avatar: { bg: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' }, bar: 'bg-indigo-500', hex: '#6366f1' },
  // Index 7: Rose (new staff)
  { card: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-400' }, avatar: { bg: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' }, bar: 'bg-rose-500', hex: '#f43f5e' },
  // Index 8: Amber (new staff)
  { card: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-400' }, avatar: { bg: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' }, bar: 'bg-amber-500', hex: '#f59e0b' },
  // Index 9: Cyan (new staff)
  { card: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-400' }, avatar: { bg: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700' }, bar: 'bg-cyan-500', hex: '#06b6d4' },
];

// Mapping of legacy staff IDs to their fixed color indices
export const LEGACY_STAFF_COLOR_INDEX: { [staffId: string]: number } = {
  fatimah: 0,
  siti: 1,
  pah: 2,
  amal: 3,
};

// Get colors for a staff member (by staffId or colorIndex)
// Legacy staff (fatimah, siti, pah, amal) use fixed indices 0-3
// New staff use their assigned colorIndex (4+)
export function getStaffColors(staffId: string, colorIndex?: number | null) {
  // Check if it's a legacy staff member first
  const legacyIndex = LEGACY_STAFF_COLOR_INDEX[staffId];
  if (legacyIndex !== undefined) {
    return STAFF_COLOR_PALETTE[legacyIndex];
  }

  // For new staff, use the assigned colorIndex (default to index 4 if not assigned)
  const idx = colorIndex ?? 4;
  return STAFF_COLOR_PALETTE[idx % STAFF_COLOR_PALETTE.length];
}

// Legacy exports for backward compatibility
export const STAFF_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  fatimah: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-400' },
  siti: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-400' },
  pah: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-400' },
  amal: { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-400' },
};

// Avatar colors for mobile view (solid colors for circular avatars)
export const AVATAR_COLORS: { [key: string]: { bg: string; badge: string } } = {
  fatimah: { bg: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  siti: { bg: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  pah: { bg: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  amal: { bg: 'bg-pink-500', badge: 'bg-pink-100 text-pink-700' },
};

export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: "fatimah",
    name: "Fatimah",
    role: "Pharmacist",
    weeklyHours: 45,
    defaultOffDays: [0, 6], // Saturday, Sunday
  },
  {
    id: "siti",
    name: "Siti",
    role: "Assistant Pharmacist",
    weeklyHours: 45,
    defaultOffDays: [1, 2], // Monday, Tuesday
  },
  {
    id: "pah",
    name: "Pah",
    role: "Assistant Pharmacist",
    weeklyHours: 45,
    defaultOffDays: [1, 2], // Monday, Tuesday
  },
  {
    id: "amal",
    name: "Amal",
    role: "Pharmacist",
    weeklyHours: 32,
    defaultOffDays: [3, 4, 5], // Wednesday, Thursday, Friday
  },
]

export const SHIFT_DEFINITIONS: { [key: string]: ShiftDefinition } = {
  "11h": {
    type: "11h",
    timing: null,
    startTime: "09:15",
    endTime: "21:45",
    workHours: 11,
  },
  "9h_early": {
    type: "9h",
    timing: "early",
    startTime: "09:15",
    endTime: "19:15",
    workHours: 9,
  },
  "9h_late": {
    type: "9h",
    timing: "late",
    startTime: "11:45",
    endTime: "21:45",
    workHours: 9,
  },
  "8h_early": {
    type: "8h",
    timing: "early",
    startTime: "09:15",
    endTime: "18:15",
    workHours: 8,
  },
  "8h_late": {
    type: "8h",
    timing: "late",
    startTime: "12:45",
    endTime: "21:45",
    workHours: 8,
  },
  "7h_early": {
    type: "7h",
    timing: "early",
    startTime: "09:15",
    endTime: "17:15",
    workHours: 7,
  },
  "7h_late": {
    type: "7h",
    timing: "late",
    startTime: "13:45",
    endTime: "21:45",
    workHours: 7,
  },
  "9h_early_ramadan": {
    type: "8h+1h",
    timing: "early",
    startTime: "09:15",
    endTime: "17:15",
    workHours: 8,
  },
  "11h_ramadan": {
    type: "11h",
    timing: null,
    startTime: "09:45",
    endTime: "21:45",
    workHours: 11,
  },
}

// Keys for Ramadan-specific shifts (used to separate them in dropdown UI)
export const RAMADAN_SHIFT_KEYS = new Set(["9h_early_ramadan", "11h_ramadan"]);

// Pattern 0 (Odd ISO Weeks)
const PATTERN_0: ShiftPattern = {
  patternId: 0,
  dailyShifts: {
    fatimah: {
      1: SHIFT_DEFINITIONS["11h"], // Monday
      2: SHIFT_DEFINITIONS["11h"], // Tuesday
      3: SHIFT_DEFINITIONS["8h_early"], // Wednesday
      4: SHIFT_DEFINITIONS["8h_early"], // Thursday
      5: SHIFT_DEFINITIONS["7h_early"], // Friday
      6: null, // Saturday (off)
      0: null, // Sunday (off)
    },
    siti: {
      1: null, // Monday (off)
      2: null, // Tuesday (off)
      3: SHIFT_DEFINITIONS["11h"], // Wednesday
      4: SHIFT_DEFINITIONS["9h_early"], // Thursday
      5: SHIFT_DEFINITIONS["9h_early"], // Friday
      6: SHIFT_DEFINITIONS["9h_early"], // Saturday
      0: SHIFT_DEFINITIONS["7h_late"], // Sunday
    },
    pah: {
      1: null, // Monday (off)
      2: null, // Tuesday (off)
      3: SHIFT_DEFINITIONS["9h_late"], // Wednesday
      4: SHIFT_DEFINITIONS["9h_late"], // Thursday
      5: SHIFT_DEFINITIONS["9h_late"], // Friday
      6: SHIFT_DEFINITIONS["9h_late"], // Saturday
      0: SHIFT_DEFINITIONS["9h_early"], // Sunday
    },
    amal: {
      1: SHIFT_DEFINITIONS["8h_late"], // Monday
      2: SHIFT_DEFINITIONS["8h_late"], // Tuesday
      3: null, // Wednesday (off)
      4: null, // Thursday (off)
      5: null, // Friday (off)
      6: SHIFT_DEFINITIONS["8h_late"], // Saturday
      0: SHIFT_DEFINITIONS["8h_late"], // Sunday
    },
  },
}

// Pattern 1 (Even ISO Weeks)
const PATTERN_1: ShiftPattern = {
  patternId: 1,
  dailyShifts: {
    fatimah: {
      1: SHIFT_DEFINITIONS["11h"], // Monday
      2: SHIFT_DEFINITIONS["11h"], // Tuesday
      3: SHIFT_DEFINITIONS["8h_early"], // Wednesday
      4: SHIFT_DEFINITIONS["8h_early"], // Thursday
      5: SHIFT_DEFINITIONS["7h_late"], // Friday
      6: null, // Saturday (off)
      0: null, // Sunday (off)
    },
    siti: {
      1: null, // Monday (off)
      2: null, // Tuesday (off)
      3: SHIFT_DEFINITIONS["9h_late"], // Wednesday
      4: SHIFT_DEFINITIONS["9h_late"], // Thursday
      5: SHIFT_DEFINITIONS["9h_late"], // Friday
      6: SHIFT_DEFINITIONS["9h_late"], // Saturday
      0: SHIFT_DEFINITIONS["9h_early"], // Sunday
    },
    pah: {
      1: null, // Monday (off)
      2: null, // Tuesday (off)
      3: SHIFT_DEFINITIONS["11h"], // Wednesday
      4: SHIFT_DEFINITIONS["9h_early"], // Thursday
      5: SHIFT_DEFINITIONS["9h_early"], // Friday
      6: SHIFT_DEFINITIONS["9h_early"], // Saturday
      0: SHIFT_DEFINITIONS["7h_late"], // Sunday
    },
    amal: {
      1: SHIFT_DEFINITIONS["8h_early"], // Monday
      2: SHIFT_DEFINITIONS["8h_early"], // Tuesday
      3: null, // Wednesday (off)
      4: null, // Thursday (off)
      5: null, // Friday (off)
      6: SHIFT_DEFINITIONS["8h_early"], // Saturday
      0: SHIFT_DEFINITIONS["8h_early"], // Sunday
    },
  },
}

export const SHIFT_PATTERNS = [PATTERN_0, PATTERN_1]

// ============================================
// DEFAULT SHIFT PATTERNS FOR NEW STAFF
// ============================================

// Default patterns by role for staff not in SHIFT_PATTERNS
// These provide sensible defaults that can be overridden
export const DEFAULT_SHIFT_PATTERNS: { [role: string]: { [patternId: number]: { [dayOfWeek: number]: ShiftDefinition | null } } } = {
  // Pharmacist default: Mon-Fri working, Sat-Sun off
  "Pharmacist": {
    0: { // Pattern 0 (Odd ISO weeks)
      1: SHIFT_DEFINITIONS["11h"],       // Monday: 11h
      2: SHIFT_DEFINITIONS["11h"],       // Tuesday: 11h
      3: SHIFT_DEFINITIONS["8h_early"],  // Wednesday: 8h early
      4: SHIFT_DEFINITIONS["8h_early"],  // Thursday: 8h early
      5: SHIFT_DEFINITIONS["7h_early"],  // Friday: 7h early
      6: null,                           // Saturday: off
      0: null,                           // Sunday: off
    },
    1: { // Pattern 1 (Even ISO weeks)
      1: SHIFT_DEFINITIONS["11h"],       // Monday: 11h
      2: SHIFT_DEFINITIONS["11h"],       // Tuesday: 11h
      3: SHIFT_DEFINITIONS["8h_early"],  // Wednesday: 8h early
      4: SHIFT_DEFINITIONS["8h_early"],  // Thursday: 8h early
      5: SHIFT_DEFINITIONS["7h_late"],   // Friday: 7h late
      6: null,                           // Saturday: off
      0: null,                           // Sunday: off
    },
  },
  // Assistant Pharmacist default: Mon-Tue off, Wed-Sun working
  "Assistant Pharmacist": {
    0: { // Pattern 0 (Odd ISO weeks)
      1: null,                           // Monday: off
      2: null,                           // Tuesday: off
      3: SHIFT_DEFINITIONS["11h"],       // Wednesday: 11h
      4: SHIFT_DEFINITIONS["9h_early"],  // Thursday: 9h early
      5: SHIFT_DEFINITIONS["9h_early"],  // Friday: 9h early
      6: SHIFT_DEFINITIONS["9h_early"],  // Saturday: 9h early
      0: SHIFT_DEFINITIONS["7h_late"],   // Sunday: 7h late
    },
    1: { // Pattern 1 (Even ISO weeks)
      1: null,                           // Monday: off
      2: null,                           // Tuesday: off
      3: SHIFT_DEFINITIONS["9h_late"],   // Wednesday: 9h late
      4: SHIFT_DEFINITIONS["9h_late"],   // Thursday: 9h late
      5: SHIFT_DEFINITIONS["9h_late"],   // Friday: 9h late
      6: SHIFT_DEFINITIONS["9h_late"],   // Saturday: 9h late
      0: SHIFT_DEFINITIONS["9h_early"],  // Sunday: 9h early
    },
  },
};
