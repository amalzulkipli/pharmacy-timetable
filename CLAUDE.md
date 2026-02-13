# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Start Next.js dev server
npm run dev:turbo    # Start dev server with Turbopack
npm run dev:clean    # Clear .next cache and start dev server
npm run build        # Build production bundle (standalone output)
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
DATABASE_URL="file:./pharmacy.db"   # SQLite database path (relative to prisma/schema.prisma)
NEXTAUTH_SECRET="<generated-secret>" # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_URL="http://localhost:3000" # Base URL for NextAuth
ADMIN_PASSWORD_HASH="<base64-encoded-bcrypt-hash>"
# Generate with: node -e "const h = require('bcryptjs').hashSync('yourpassword', 12); console.log(Buffer.from(h).toString('base64'))"
# NOTE: The hash is base64-encoded to avoid $ character issues in .env parsing. Auth code decodes it before comparing.
```

## Architecture

### Tech Stack
- **Framework:** Next.js 15.5.11 (App Router, standalone output)
- **Database:** Prisma 6.19.1 with SQLite (`prisma/pharmacy.db`)
- **UI:** React 19, TypeScript, Tailwind CSS v4
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

**Route Protection:** `src/middleware.ts` protects `/admin/*` routes and most API routes using NextAuth v5 JWT sessions. Only `GET /api/overrides` (schedule data) is publicly accessible without auth. All other API requests (including GET to staff/leave endpoints) require authentication. Redirects to `/login` for admin pages, returns 401 JSON for API routes.

**Login Flow:** Users can login via:
1. Click login icon on calendar → shows LoginModal overlay with blurred background
2. Direct access to `/admin/*` → redirects to `/login` page (also modal style)

**Authentication:** Uses NextAuth v5 with Credentials provider. Password is stored as bcrypt hash in `ADMIN_PASSWORD_HASH` environment variable. Session is JWT-based with 24-hour expiry.

### API Routes

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/overrides` | Fetch/save schedule overrides (GET returns draft if exists, POST saves to draft) |
| `POST /api/overrides/publish` | Publish drafts to ScheduleOverride, update leave balances |
| `POST /api/overrides/discard` | Discard drafts for a month |
| `GET/POST /api/staff` | List/create staff members |
| `PUT/DELETE /api/staff/[staffId]` | Update/deactivate staff |
| `GET /api/leave/balances` | Leave balances by year |
| `GET/DELETE /api/leave/history` | Leave history entries (GET with staffId param, DELETE by id) |
| `POST /api/leave/calculate-rl` | Recalculate replacement leave |
| `GET/POST /api/leave/maternity` | Get active maternity periods / Create 98-day maternity leave |
| `GET /api/health` | Health check endpoint (no auth required) |
| `POST /api/migrate` | Seed database with initial data |

### Key Hooks (`src/hooks/`)

- `useScheduleDB.ts` - Database operations for overrides with offline fallback to localStorage
- `useStaff.ts` - Fetches staff from database, merges with legacy hardcoded `STAFF_MEMBERS`. Exports `getActiveStaffForDate()` for filtering by start date
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
- CSV export (admin only)
- Mobile responsive with `MobileStaffCard`
- Overrides persisted via `useScheduleOverridesDB` hook

### Important Implementation Details

1. **Leave Balance Year Handling:** When saving leave, balance updates use `leaveDate.getFullYear()` not the calendar view year. Critical for cross-year boundaries.

2. **Prisma Client Location:** Generated to `src/generated/prisma/` per schema config. Import from `@/generated/prisma`.

3. **Day-of-Week Numbering:** Uses JavaScript convention where 0=Sunday, 1=Monday, ..., 6=Saturday. The `defaultOffDays` field in Staff stores this as JSON array string (e.g., `"[0,6]"` for Sunday/Saturday off).

4. **Offline Support:** `useScheduleOverridesDB` caches to localStorage and queues changes when offline. Cache keys: `pharmacy-cache-YYYY-MM` (read cache), `pharmacy-pending-YYYY-MM` (pending changes).

5. **Staff Colors:** `STAFF_COLOR_PALETTE` in `staff-data.ts` provides 10 colors (indices 0-9). Legacy staff (fatimah, siti, pah, amal) use fixed indices 0-3 via `LEGACY_STAFF_COLOR_INDEX`. New staff are auto-assigned indices 4+. Use `getStaffColors(staffId, colorIndex)` to get the full color object (card, avatar, bar, hex). Legacy exports `STAFF_COLORS` and `AVATAR_COLORS` maintained for backward compatibility.

6. **Public Holidays:** Stored in database, used for RL calculation. On holidays, all staff marked as off.

7. **Schedule Generation:** Base patterns are fixed in SHIFT_PATTERNS. The algorithm applies leave constraints, validates coverage, and adjusts OFF days to maintain the 2-consecutive-day rule while ensuring pharmacy coverage.

8. **Authentication:** Uses NextAuth v5 with Credentials provider. Password is bcrypt-hashed, then base64-encoded, and stored in `ADMIN_PASSWORD_HASH` env var (server-side only). The auth code (`src/lib/auth.ts`) decodes from base64 before bcrypt comparison. JWT session strategy with 24-hour expiry.

9. **StaffCard Edit Mode Colors:** In `StaffCard`, card colors use `editValue` prop when in edit mode (not `staffShift` data) so colors update immediately on dropdown change.

10. **Copy/Paste Week Shifts:** In edit mode, Sundays show a kebab menu (⋮) to copy/paste entire week shifts. Copies by day-of-week mapping (Mon→Mon, Tue→Tue). State: `copiedWeek` stores `{weekNumber, data: Record<dayOfWeek_staffId, shiftKey>}`. Clipboard badge shows in toolbar when active.

11. **New Staff Shift Patterns:** Staff not in the hardcoded `SHIFT_PATTERNS` (legacy staff) use `DEFAULT_SHIFT_PATTERNS` in `staff-data.ts`, which provides role-based defaults ("Pharmacist" or "Assistant Pharmacist") for both pattern 0 and pattern 1.

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

## Mobile Responsiveness

- **Breakpoint:** 768px (Tailwind `md`)
- **Mobile:** Bottom navigation tabs, `MobileStaffCard` with avatars using `AVATAR_COLORS`
- **Desktop:** Side tabs in AdminPanel, full calendar grid with staff cards

Admin logout button visibility is controlled via mobile-specific styling in `Calendar.tsx`.

## Testing

No test framework is currently configured. `npm run lint` runs ESLint as the only automated check.

## Deployment (Dokploy on Hetzner VPS)

- **URL:** https://st.farmasialde.com/timetable
- **Docker service:** `fasttimetable-main-xfkjbh`
- **Database volume:** `pharmacy_data` → mounted at `/app/prisma/`
- **DB on host:** `/var/lib/docker/volumes/pharmacy_data/_data/pharmacy.db`
- **Auto-deploy:** GitHub webhook → Dokploy (push to `main` triggers build + deploy)
- **Backup:** Daily at 2:00 AM via `/root/scripts/backup-pharmacy-timetable.sh`, 7-day retention

### Production Environment Variables (set in Dokploy, not .env)

```bash
NEXTAUTH_URL=https://st.farmasialde.com    # WITHOUT /timetable (see quirks below)
NEXTAUTH_SECRET=<secret>
ADMIN_PASSWORD_HASH=<base64-encoded-bcrypt>
DATABASE_URL=file:./pharmacy.db
NODE_ENV=production
HOSTNAME=0.0.0.0
```

### Production Quirks

- **NextAuth v5 + basePath:** Do NOT set `basePath` in NextAuth config or include `/timetable` in `NEXTAUTH_URL`. Next.js basePath already strips `/timetable` before the request reaches NextAuth. Setting either causes `UnknownAction` errors.
- **Health check:** Must use `http://0.0.0.0:3000` not `http://localhost:3000` in Dockerfile. Alpine Linux in Docker Swarm doesn't resolve localhost to 0.0.0.0.
- **Auth redirect:** The `redirect` callback in `src/lib/auth.ts` handles sending users to `/timetable` after login, since NextAuth defaults to redirecting to `/`.
- **Volume mount:** Ensure no trailing spaces in Dokploy volume mount path — the UI can accidentally include them.
