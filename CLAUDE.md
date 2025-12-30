# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Start Next.js dev server with Turbopack
npm run build        # Build production bundle
npm start            # Start production server
npm run lint         # Run ESLint
```

### TypeScript
The project uses TypeScript with strict mode enabled. Path aliases are configured:
- `@/*` maps to `./src/*`

## Architecture

### Tech Stack
- **Framework:** Next.js 15.3.4 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS v4
- **PDF Generation:** Puppeteer (server-side)
- **Date Utilities:** date-fns

### Core System: Schedule Generation

The application generates pharmacy staff schedules based on **alternating weekly patterns** tied to ISO week numbers:
- **Odd ISO weeks** use Pattern 0 (PATTERN_0)
- **Even ISO weeks** use Pattern 1 (PATTERN_1)

Each pattern defines shift assignments for all 4 staff members across 7 days of the week. This two-week rotation ensures balanced workloads and predictable schedules.

**Key Files:**
- `src/lib/schedule-generator.ts` - Core scheduling algorithm using ISO week-based pattern selection
- `src/staff-data.ts` - Defines SHIFT_PATTERNS (2 patterns), SHIFT_DEFINITIONS, and STAFF_MEMBERS
- `src/types/schedule.ts` - TypeScript interfaces for all schedule-related data structures

### Staff Configuration (`src/staff-data.ts`)

**4 Staff Members:**
1. **Fatimah** (Pharmacist, 45h/week) - Off Sat/Sun
2. **Siti** (Assistant, 45h/week) - Off Mon/Tue
3. **Pah** (Assistant, 45h/week) - Off Mon/Tue
4. **Amal** (Pharmacist, 32h/week) - Off Wed/Thu/Fri

**Shift Types:**
- 11h shift: 09:15-21:45
- 9h shifts: Early (09:15-19:15), Late (11:45-21:45)
- 8h shifts: Early (09:15-18:15), Late (12:45-21:45)
- 7h shifts: Early (09:15-17:15), Late (13:45-21:45)

**Pattern Logic:**
Each staff member has different shift assignments in Pattern 0 vs Pattern 1 to create variety. For example:
- Fatimah works 11h Monday-Tuesday in both patterns, but Friday differs (7h early in P0, 7h late in P1)
- Siti and Pah alternate between early/late shift timing patterns each week

### Schedule Overrides & Persistence

The Calendar component (`src/components/Calendar.tsx`) supports manual schedule overrides that are persisted in `localStorage`:
- Users can override shifts, mark staff as on leave (AL/RL/EL), or add temporary replacement staff
- Overrides are stored with a unique key per month/year
- The system maintains a distinction between pattern-based shifts and manually overridden shifts via the `isOverride` flag

### Public Holidays

Hardcoded in `src/lib/schedule-generator.ts` as `PUBLIC_HOLIDAYS_2025`. On public holidays:
- All staff are automatically marked as off (shift = null)
- The schedule generator blocks all shifts for these dates

### Components

**`src/components/Calendar.tsx`** (Main UI Component)
- Renders monthly calendar in 7-column CSS Grid (Mon-Sun)
- Supports admin mode (`isAdmin` prop) for editing schedules
- Handles CSV/PDF export functionality
- Manages schedule overrides in localStorage
- Displays weekly hour summaries and monthly totals
- Complex component with ~800+ lines handling UI, state, and export logic

**`src/components/AuthWrapper.tsx`**
- Authentication wrapper for admin access control

**`src/components/DataManager.tsx`**
- Data management interface (likely for editing staff/shifts)

### PDF Generation (`src/app/api/generate-pdf/route.ts`)

**Critical Technical Context:**
- Tailwind CSS v4 uses modern `oklch()` color functions that are incompatible with html2canvas
- Solution: Server-side PDF generation using Puppeteer with CSS overrides
- The API endpoint receives HTML + styles from the frontend, then generates PDF server-side

**PDF Layout:**
- A4 landscape format
- 2 weeks per page for optimal readability
- CSS Grid requires specific rendering fixes for Puppeteer (see PDF-specific CSS in the route handler)

**Endpoint:** `POST /api/generate-pdf`
```typescript
{
  html: string,      // Complete calendar HTML
  styles: string,    // Extracted CSS styles
  title: string,     // PDF title
  filename: string   // Output filename
}
```

### Weekly Hours Calculation

The system tracks weekly hours for each staff member to ensure compliance with contracted hours:
- Calculated in `calculateWeeklyHours()` function in `schedule-generator.ts`
- Used to display summaries in the Calendar UI
- Helps identify weeks where staff may be under-scheduled

### Type System (`src/types/schedule.ts`)

**Key Interfaces:**
- `StaffMember` - Staff configuration with role, weeklyHours, defaultOffDays
- `ShiftDefinition` - Defines shift type, timing, start/end times, work hours
- `ShiftPattern` - Weekly pattern with dailyShifts mapping (staffId -> dayOfWeek -> ShiftDefinition)
- `DaySchedule` - Single day with staffShifts, holiday info, overrides, leave tracking
- `MonthSchedule` - Complete month with days array and weeklyHours calculations
- `ReplacementShift` - Temporary replacement staff assignments

### Important Implementation Details

1. **ISO Week-Based Patterns:** The entire schedule logic relies on `getISOWeek()` from date-fns. Pattern selection via `getPatternForWeek(isoWeek)` determines which SHIFT_PATTERN applies.

2. **Date Handling:** Uses date-fns extensively for date manipulation. Week starts on Monday (`weekStartsOn: 1`).

3. **Color Coding:** Staff members have distinct colors defined in STAFF_COLORS (blue, green, purple, pink) for visual identification.

4. **localStorage Keys:** Schedule overrides are stored with keys like `schedule-override-{month}-{year}`.

5. **Grid Layout:** CSS Grid is central to the UI. Uses `grid-cols-7` with specific styling for calendar cells.

## Known Technical Issues

1. **Tailwind v4 + PDF Generation:** Solved by using Puppeteer instead of client-side html2canvas
2. **CSS Grid in PDF:** Requires specific width/layout fixes in the PDF generation route
3. **Performance:** PDF generation takes 3-5 seconds per document due to Puppeteer rendering

## Future Considerations

The README mentions planned features including:
- Staff management UI (add/edit/remove staff)
- Customizable shift templates
- Conflict detection and visual warnings
- Database integration (currently all data is in-memory/localStorage)
- Real-time collaboration features
