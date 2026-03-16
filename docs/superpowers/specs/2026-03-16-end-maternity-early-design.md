# End Maternity Leave Early Design

## Problem

Maternity leave creates 98 consecutive days of MAT entries across ScheduleDraft/ScheduleOverride, LeaveHistory, and LeaveBalance. There is no mechanism to end it early. When a staff member (e.g., Fatimah) wants to return to work before the 98 days, the admin cannot remove the MAT entries — the system's MAT protection in `POST /api/overrides` silently reverts manual edits.

## Requirements

1. Admin can end an active maternity leave period early by selecting a return-to-work date
2. All MAT entries from the return date onward are deleted (overrides, drafts, history)
3. Leave balance (matUsed) is corrected to reflect actual days taken
4. The feature lives in the Leave tab on the staff's leave card
5. Maternity-only — not a generic leave reversal feature

## Approach

Single API endpoint (`POST /api/leave/maternity/end-early`) that performs all cleanup in one atomic transaction. Deletes future MAT records rather than filtering at render time — the data represents days that never happened and has no audit value.

## Design

### 1. API Endpoint

**`POST /api/leave/maternity/end-early`**

Request body:
```json
{ "staffId": "fatimah", "returnDate": "2026-04-01" }
```

`returnDate` is the first day back at work (exclusive — last MAT day is returnDate - 1).

Transaction steps:

1. **Find active period:** `MaternityLeavePeriod WHERE staffId AND status = 'active'`. Return 404 if none.
2. **Validate:** `returnDate > period.startDate AND returnDate <= period.endDate`. Return 400 if invalid. (`returnDate = startDate` rejected — that's a cancellation, not ending early. `returnDate = endDate` is valid — removes the last day only.)
3. **Delete ScheduleOverride:** `WHERE staffId AND date >= returnDate AND leaveType = 'MAT'`
4. **Delete ScheduleDraft:** `WHERE staffId AND date >= returnDate AND leaveType = 'MAT'`
5. **Clean up DraftMonth:** For each month affected by step 4 deletions, count remaining ScheduleDraft entries. If zero remain for that month, delete the DraftMonth record (prevents orphaned "Unpublished" badge).
6. **Count + delete LeaveHistory:** `WHERE staffId AND date >= returnDate AND leaveType = 'MAT' AND status = 'approved'`. Group count by year for balance adjustment.
7. **Decrement LeaveBalance.matUsed:** For each year in the count, decrement by the number of deleted history entries. Handles cross-year maternity correctly (uses `date.getFullYear()`).
8. **Update MaternityLeavePeriod:** Set `endDate = returnDate - 1 day`, `status = 'ended_early'`.

Response:
```json
{ "success": true, "daysRemoved": 52, "newEndDate": "2026-03-31T00:00:00.000Z" }
```

### 2. Schema Change

Add `'ended_early'` as a valid status value for MaternityLeavePeriod. The field is a String (not enum) in SQLite, so no migration needed — just use the new value in code.

Update code that filters by status:
- `GET /api/leave/maternity` filters `status: 'active'` — no change needed (ended_early periods won't show as active)
- `GET /api/leave/balances` filters `status: 'active'` for activePeriod — no change needed (ended_early won't appear as active)
- `POST /api/leave/maternity` overlap check filters `status: 'active'` — no change needed (ended_early won't block new maternity)

No Prisma schema change needed. No Docker migration needed. Update the status comment in `prisma/schema.prisma` from `// "active" | "cancelled"` to `// "active" | "cancelled" | "ended_early"` for documentation accuracy.

### 3. UI — StaffLeaveCard

**Location:** `src/components/admin/StaffLeaveCard.tsx`, in the maternity leave section where the "Active" badge and date range are displayed.

**When period is active:**
- Add "End Early" button next to the "Active" badge
- On click: opens confirmation dialog with date picker
- Dialog shows: staff name, selected return date, calculated days to remove
- Confirm calls `POST /api/leave/maternity/end-early`
- On success: refreshes leave data

**After ending early:**
- Badge changes from "Active" (green) to "Ended Early" (gray/amber)
- Date range shows actual period: startDate → newEndDate
- "End Early" button disappears
- matUsed shows corrected count

### 4. Unchanged Layers

- **Calendar.tsx** — MAT ScheduleOverride/Draft entries are deleted, so they won't render. Base schedule takes over for those dates (Fatimah gets regular shifts).
- **Schedule generator** — No MAT overrides = generates normal shifts for Fatimah from returnDate.
- **`POST /api/overrides` MAT protection** — Only triggers when MAT entries exist. After deletion, no MAT entries exist for those dates, so protection doesn't apply.
- **`applyOverrides` endDate filter** — Fatimah has no staff endDate (she's returning, not leaving). No conflict.
- **Public view** — ScheduleOverride MAT entries deleted, public sees regular schedule.
- **LeaveOverview.tsx** — Fetches fresh data; shows updated balance after API call.

### 5. Edge Cases

- **returnDate = period.startDate + 1 day:** Only 1 day of maternity taken. Valid — removes 97 days.
- **returnDate = period.startDate:** Zero days taken — rejected with 400 "Return date must be after the maternity start date." (Use cancellation instead.)
- **returnDate = period.endDate:** Removes only the last day. Valid — a minor adjustment.
- **returnDate > period.endDate:** Rejected with 400 "Return date must be within the maternity period."
- **Cross-year maternity:** e.g., starts Dec 2025, ends Mar 2026. If returnDate is Feb 1, 2026: delete Jan-Mar 2026 entries, decrement 2026 LeaveBalance only. Dec 2025 entries stay (those days were actually taken).
- **Some months published, others in draft:** Transaction handles both — deletes from ScheduleOverride AND ScheduleDraft. LeaveHistory only exists for published months, so balance decrement matches.
- **Admin tries to end early on already-ended period:** `status: 'active'` filter returns null → 404.

## Files Changed

| File | Change | Priority |
|------|--------|----------|
| `src/app/api/leave/maternity/route.ts` | Add end-early handler (new POST endpoint at `/api/leave/maternity/end-early`) | CRITICAL |
| `src/components/admin/StaffLeaveCard.tsx` | Add "End Early" button + confirmation dialog | HIGH |
| `src/app/api/leave/balances/route.ts` | Return `ended_early` periods with different badge (optional) | LOW |

Note: Since Next.js App Router uses file-based routing, the end-early endpoint needs its own route file at `src/app/api/leave/maternity/end-early/route.ts`.
