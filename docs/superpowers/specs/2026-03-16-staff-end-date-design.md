# Staff End Date (End of Service) Design

## Problem

When staff members leave the pharmacy (e.g., Amal and Aina stopping in April 2026), there is no way to phase them out on a specific date. The only mechanism is `isActive = false`, which hides them from **all** dates — past and future — breaking historical timetable views.

## Requirements

1. Admin can set an `endDate` on a staff member via a dedicated "End Service" action
2. Staff disappears from timetable on `endDate` onward (last visible day = endDate - 1)
3. Historical data preserved — navigating to past months still shows the staff
4. End date is editable and clearable after being set
5. Existing "Remove" action renamed to "Set Inactive" — still sets `isActive = false`
6. No data is ever deleted — both mechanisms are soft/reversible

## Approach

Add an `endDate` field to the `Staff` model. Filter staff per-day in schedule generation using both `startDate` and `endDate` boundaries. The API layer does not filter by `endDate` — it returns all active staff and lets the client-side schedule generator handle date-based visibility.

## Design

### 1. Database Schema

Add one nullable field to the `Staff` model in `prisma/schema.prisma`:

```prisma
endDate DateTime? // Staff disappears from timetable on this date onward
```

Place after `startDate` (line ~29).

**Prisma migration:**
```bash
npx prisma migrate dev --name add_staff_end_date
```

**Docker migration** in `docker-entrypoint.sh` — follow existing idempotent pattern (check column existence before altering):
```bash
if sqlite3 "$DB_PATH" "PRAGMA table_info('Staff')" | grep -q endDate; then
  echo "  staff_end_date: already applied"
else
  echo "  staff_end_date: applying..."
  sqlite3 "$DB_PATH" <<'SQL'
ALTER TABLE "Staff" ADD COLUMN "endDate" DATETIME;
SQL
  echo "  staff_end_date: applied"
fi
```

This is a nullable column addition — no existing rows are affected. No default value needed (null = no end date = staff active indefinitely).

### 2. Filtering Rule

Staff is visible on a given `date` when ALL of:
- `isActive = true`
- `startDate` is null OR `date >= startDate`
- `endDate` is null OR `date < endDate`

`endDate` is **exclusive**: setting `endDate = 2026-04-01` means last visible day is March 31, 2026.

**Validation:** If both `startDate` and `endDate` are set, `endDate` must be after `startDate`. Return 400 if violated.

### 3. API Changes

#### `GET /api/staff` (`src/app/api/staff/route.ts`)
- **No filter change** — still returns `where: { isActive: true }`
- **Add `endDate` to response** — include alongside `startDate` in returned fields

Rationale: date-based filtering happens client-side in schedule generator. The API must return ended staff so they appear in past months.

#### `GET /api/staff/[staffId]` (`src/app/api/staff/[staffId]/route.ts`)
- **Add `startDate`, `endDate`, `colorIndex` to response** — align response shape with list endpoint

#### `PUT /api/staff/[staffId]` (`src/app/api/staff/[staffId]/route.ts`)
- Add `endDate` and `startDate` to body destructuring (note: `startDate` is currently sent by the form but silently ignored — pre-existing bug, fix alongside)
- Validate: if both `startDate` and `endDate` are non-null, `endDate` must be after `startDate` (return 400)
- Store as DateTime or null
- Add `startDate`, `endDate`, `colorIndex` to response (align with list endpoint)

#### `DELETE /api/staff/[staffId]`
- **No change** — still sets `isActive = false`

#### All other API routes
- **No changes** — overrides, publish, discard, leave balance, leave history, maternity, calculate-rl, migrate all work on staffId directly and don't filter by endDate

### 4. Staff Filtering Logic

The primary filtering happens in `generateMonthSchedule()`. The `getActiveStaffForDate()` function in `useStaff.ts` is currently unused (dead code) but is updated for completeness / future use.

#### `generateMonthSchedule()` in `src/lib/schedule-generator.ts` (lines 105-116)
This is the **source of truth** for timetable rendering. Add `endDate` check after the existing `startDate` check:
```typescript
// After startDate check:
if (dbStaff.endDate) {
  const staffEnd = new Date(dbStaff.endDate);
  if (checkDate >= staffEnd) return false;
}
```

#### `getActiveStaffForDate()` in `src/hooks/useStaff.ts` (lines 119-136)
Currently unused but update for consistency. Add same `endDate` boundary check.

### 5. Client Data Layer

#### `DatabaseStaffMember` interface in `src/hooks/useStaff.ts`
Add `endDate?: Date | null` field alongside `startDate`.

#### `useStaffMembers()` hook in `src/hooks/useStaff.ts`
- Transform `endDate` from API response (ISO string → Date), same as `startDate`
- Include in legacy staff merge: `endDate: dbRecord?.endDate || null`

**Note:** The legacy staff merge does NOT filter by `endDate` — it only propagates the field. Filtering happens downstream in `generateMonthSchedule()`.

### 6. Admin UI — StaffManagement

#### Staff interface (`src/components/admin/StaffManagement.tsx`)
Add `endDate?: string | null` to the Staff interface.

#### "End Service" button
- New button on each staff card/row (alongside existing trash icon for "Set Inactive")
- Opens a confirmation dialog with:
  - Date picker for selecting end date
  - Calculated display: "Last day on timetable: [endDate - 1 day formatted]"
  - Confirm / Cancel buttons
- On confirm: `PUT /api/staff/[staffId]` with `{ endDate: selectedDate }`

#### After end date is set
- Staff card shows badge: "Ends: 1 Apr 2026"
- "End Service" button area changes to show Edit / Clear options
- Edit: reopens date picker dialog with current end date pre-filled
- Clear: `PUT /api/staff/[staffId]` with `{ endDate: null }` — staff appears on all future dates again

#### "Remove" button rename
- Confirmation dialog text changes from "Are you sure you want to deactivate this staff member?" to "Are you sure you want to set this staff member as inactive?"
- Button tooltip/label: "Set Inactive"
- Same behavior: calls `DELETE /api/staff/[staffId]` → `isActive = false`

### 7. Unchanged Layers

These require **no changes** — they work correctly because filtering happens upstream:

- **Calendar.tsx** — renders from pre-filtered schedule data
- **CSV export** — exports whatever the current schedule shows (staff who ended before the month get all `-` columns — acceptable)
- **Mobile views** — render from same filtered data
- **Leave overview / StaffLeaveCard** — fetches via `GET /api/staff` (returns active staff regardless of endDate, so leave records remain visible)
- **Leave balance APIs** — filter by `isActive: true` which is correct (ended staff is still `isActive = true`, just date-bounded)
- **Overrides publish/discard** — operate on date+staffId, no staff filtering
- **Maternity leave API** — uses explicit staffId (admin could create maternity leave past endDate; entries would be invisible in calendar but harmless — acceptable edge case)
- **Public holiday / RL calculation** — filters by `isActive: true`
- **Seeding / migrate** — creates staff without endDate (null = no end)

### 8. Known Limitations

- **Public calendar view:** Does not respect `endDate` for legacy staff (fatimah, siti, pah, amal) because the public view cannot access `GET /api/staff` without authentication. This is a pre-existing limitation that also affects `startDate`. Fixing this would require making a limited staff endpoint public — out of scope for this feature.
- **Orphaned drafts:** If endDate is set while drafts exist for dates after the endDate, those drafts remain in the database but won't render. They are harmless and will be overwritten if endDate is later cleared. No cleanup needed.
- **Setting endDate to today:** Staff disappears from today's schedule (last visible = yesterday). The UI shows "Last day on timetable: [yesterday]" making this clear to the admin.

## Files Changed

| File | Change | Priority |
|------|--------|----------|
| `prisma/schema.prisma` | Add `endDate` field | CRITICAL |
| `docker-entrypoint.sh` | Add idempotent ALTER TABLE migration | CRITICAL |
| `src/lib/schedule-generator.ts` | Add `endDate` filter in `generateMonthSchedule()` | CRITICAL |
| `src/hooks/useStaff.ts` | Interface, transform, merge, `getActiveStaffForDate()` | CRITICAL |
| `src/app/api/staff/route.ts` | Include `endDate` in GET response | HIGH |
| `src/app/api/staff/[staffId]/route.ts` | Accept `endDate`+`startDate` in PUT, align GET/PUT responses | HIGH |
| `src/components/admin/StaffManagement.tsx` | End Service UI, rename Remove | HIGH |
| `CLAUDE.md` | Document `endDate` field and filtering behavior | LOW |

## Migration Safety

- **Nullable column addition** — no existing rows affected, no default needed
- **No table drops or renames** — purely additive
- **No index changes** — `endDate` doesn't need an index (filtered client-side, not in SQL queries)
- **Docker entrypoint migration** is idempotent — checks column existence before altering (follows existing pattern)
- **Backward compatible** — null endDate = current behavior (staff active indefinitely)
