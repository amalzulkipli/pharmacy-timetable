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

### Database (Prisma + SQLite)
```bash
npx prisma migrate dev --name <migration_name>  # Create and apply migration
npx prisma generate                              # Regenerate Prisma client
npx prisma studio                                # Open database GUI
npx prisma db push                               # Push schema changes (dev only)
```

**Note:** Prisma client is generated to `src/generated/prisma/` (not the default location).

### TypeScript
The project uses TypeScript with strict mode. Path alias: `@/*` maps to `./src/*`

### Environment Variables
Required in `.env`:
```bash
DATABASE_URL="file:./prisma/pharmacy.db"   # SQLite database path
NEXT_PUBLIC_ADMIN_PASSWORD=<password>       # Admin login password
```

## Architecture

### Tech Stack
- **Framework:** Next.js 15.5.9 (App Router, Turbopack)
- **Database:** Prisma 6.19.1 with SQLite (`prisma/prisma/pharmacy.db`)
- **UI:** React 19, TypeScript, Tailwind CSS v4
- **PDF Generation:** Puppeteer (server-side)
- **Date Utilities:** date-fns
- **Icons:** lucide-react

### Database Schema (`prisma/schema.prisma`)

**Core Models:**
- `Staff` - Staff members with entitlements (alEntitlement, mlEntitlement)
- `ScheduleOverride` - Published schedule changes per date/staff
- `ScheduleDraft` - Unpublished schedule changes (same structure as ScheduleOverride)
- `DraftMonth` - Tracks which months have unpublished drafts (year, month)
- `ReplacementShift` - Temporary replacement staff
- `LeaveBalance` - Yearly leave tracking (AL/RL/ML used/remaining per staff)
- `LeaveHistory` - Individual leave entries with dates and types
- `PublicHoliday` - Holiday dates for RL calculation

**Leave Types:** `AL` (Annual), `RL` (Replacement), `EL` (Emergency), `ML` (Medical), `MAT` (Maternity)

**Maternity Leave Model:**
- `MaternityLeavePeriod` - Tracks active maternity leave periods (staffId, startDate, endDate, status)

### Core System: Schedule Generation

Schedules use **alternating weekly patterns** based on ISO week numbers:
- **Odd ISO weeks** → Pattern 0
- **Even ISO weeks** → Pattern 1

**Scheduling Constraints:**
- Each staff member works exactly 5 days per week
- Each staff member has exactly 2 consecutive days off per week
- OFF day patterns can shift dynamically based on leave patterns
- Minimum coverage requirements must be met for all shifts

**Key Files:**
- `src/lib/schedule-generator.ts` - Scheduling algorithm with ISO week pattern selection
- `src/staff-data.ts` - SHIFT_PATTERNS, SHIFT_DEFINITIONS, STAFF_MEMBERS, AVATAR_COLORS
- `src/types/schedule.ts` - TypeScript interfaces

### Page Routes

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Public calendar view (read-only) | Public |
| `/login` | Admin login page (modal style with blurred background) | Public |
| `/admin` | Admin dashboard with tabbed interface (Timetable/Leave/Staff) | Protected |

**Route Protection:** `src/middleware.ts` protects `/admin/*` routes using cookies. Redirects to `/login` if not authenticated.

**Login Flow:** Users can login via:
1. Click login icon on calendar → shows LoginModal overlay with blurred background
2. Direct access to `/admin/*` → redirects to `/login` page (also modal style)

### API Routes

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/overrides` | Fetch/save schedule overrides (GET returns draft if exists, POST saves to draft) |
| `POST /api/overrides/publish` | Publish drafts to ScheduleOverride, update leave balances |
| `POST /api/overrides/discard` | Discard drafts for a month |
| `GET/POST /api/staff` | List/create staff members |
| `PUT/DELETE /api/staff/[staffId]` | Update/deactivate staff |
| `GET /api/leave/balances` | Leave balances by year |
| `GET /api/leave/history` | Leave history entries |
| `POST /api/leave/calculate-rl` | Recalculate replacement leave |
| `GET/POST /api/leave/maternity` | Get active maternity periods / Create 98-day maternity leave |
| `POST /api/migrate` | Seed database with initial data |
| `POST /api/generate-pdf` | Server-side PDF generation |

### Key Hooks (`src/hooks/`)

- `useScheduleDB.ts` - Database operations for overrides with offline fallback to localStorage
- `useAuth.ts` - Admin authentication
- `useLocalStorage.ts` - Local storage utilities

### Admin Components (`src/components/admin/`)

- `AdminPanel.tsx` - Tabbed container (Timetable/Leave/Staff tabs) for admin dashboard
- `LeaveOverview.tsx` - Staff leave dashboard with balance cards
- `StaffLeaveCard.tsx` - Individual staff leave display with history accordion
- `StaffHoursOverview.tsx` - Weekly hours summary for staff
- `StaffManagement.tsx` - CRUD for staff members and entitlements

### Calendar Component (`src/components/Calendar.tsx`)

Main UI (~1400 lines), accepts `mode` prop:
- `mode="public"` - Read-only view for regular staff (used at `/`)
- `mode="admin"` - Full edit mode with summaries, alerts, data manager (used at `/admin/schedule`)
- 7-column CSS Grid (Mon-Sun)
- CSV/PDF export (admin only)
- Mobile responsive with `MobileStaffCard`
- Overrides persisted via `useScheduleOverridesDB` hook

### Important Implementation Details

1. **Leave Balance Year Handling:** When saving leave, balance updates use `leaveDate.getFullYear()` not the calendar view year. Critical for cross-year boundaries.

2. **Prisma Client Location:** Generated to `src/generated/prisma/` per schema config. Import from `@/generated/prisma`.

3. **Offline Support:** `useScheduleOverridesDB` caches to localStorage and queues changes when offline. Cache keys: `pharmacy-cache-YYYY-MM` (read cache), `pharmacy-pending-YYYY-MM` (pending changes).

4. **Staff Colors:** `STAFF_COLORS` (card styling) and `AVATAR_COLORS` (mobile avatars) in `staff-data.ts`, keyed by staffId.

5. **Public Holidays:** Stored in database, used for RL calculation. On holidays, all staff marked as off.

6. **Schedule Generation:** Base patterns are fixed in SHIFT_PATTERNS. The algorithm applies leave constraints, validates coverage, and adjusts OFF days to maintain the 2-consecutive-day rule while ensuring pharmacy coverage.

7. **Authentication:** Cookie-based auth via `useAuth` hook. Login sets `pharmacy-admin-auth` cookie (24h expiry) for middleware protection. Password stored in `NEXT_PUBLIC_ADMIN_PASSWORD` env var.

### Draft/Publish Workflow

Schedule changes follow a draft-first pattern:
- **Editing:** All changes save to `ScheduleDraft` table (not immediately published)
- **Tracking:** `DraftMonth` records which months have unpublished changes
- **Publishing:** Admin publishes drafts → copies to `ScheduleOverride`, updates leave balances
- **Discarding:** Admin can discard drafts → deletes from `ScheduleDraft`, clears `DraftMonth`
- **View modes:** Public users see only published (`ScheduleOverride`), admins see drafts if they exist

### Maternity Leave (98 Days)

Maternity leave is a special leave type that creates 98 consecutive days of leave in one action:

**User Flow:**
1. Admin selects "Maternity Leave (98 days)..." from dropdown (desktop) or bottom sheet (mobile)
2. `MaternityLeaveModal` opens with date picker and shows calculated end date (start + 97 days)
3. On confirm, `POST /api/leave/maternity` creates:
   - `MaternityLeavePeriod` record to track the active period
   - 98 `ScheduleDraft` entries (one per day with `leaveType: 'MAT'`)
   - `DraftMonth` records for all affected months
4. Calendar refreshes to show MAT leave in draft mode
5. Admin publishes each affected month when ready

**Key Files:**
- `src/components/MaternityLeaveModal.tsx` - Modal UI for selecting start date
- `src/app/api/leave/maternity/route.ts` - Batch creates 98 draft entries

**Display:** MAT leave displays with orange text like other leave types in calendar view.

### Offline Sync Strategy

The `useScheduleOverridesDB` hook implements an offline-first pattern:
- **Online:** Fetches from `/api/overrides`, caches result to localStorage
- **Offline:** Loads from localStorage cache, queues changes to pending storage
- **Reconnect:** Auto-syncs pending changes when network returns
- **Priority:** Pending changes override cached data (most recent edits win)

### Schedule Pattern Matching

When looking up shift patterns:
- `getISOWeek()` from date-fns determines week number
- ISO week numbers differ from calendar week numbers (week starts Monday, week 1 contains Jan 4)
- Pattern matching in `findShiftKey()` uses startTime + endTime + workHours tuple

## PDF Generation

Tailwind CSS v4's `oklch()` colors are incompatible with html2canvas. Solution: Puppeteer server-side rendering.

**Endpoint:** `POST /api/generate-pdf`
```typescript
{ html: string, styles: string, title: string, filename: string }
```

**Layout:** A4 landscape, 2 weeks per page, CSS Grid fixes for Puppeteer.

## Mobile Responsiveness

- **Breakpoint:** 768px (Tailwind `md`)
- **Mobile:** Bottom navigation tabs, `MobileStaffCard` with avatars using `AVATAR_COLORS`
- **Desktop:** Side tabs in AdminPanel, full calendar grid with staff cards

Admin logout button visibility is controlled via mobile-specific styling in `Calendar.tsx`.
