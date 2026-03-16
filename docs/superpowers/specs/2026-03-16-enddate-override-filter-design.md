# EndDate Override Filter Design

## Problem

Staff with `endDate` set still appear in the timetable for dates after their end date. The base schedule generator (`generateMonthSchedule`) correctly filters by endDate per-day, but `applyOverrides()` in Calendar.tsx blindly merges database overrides back into `staffShifts`, bypassing the endDate filter. This causes ended staff to reappear wherever saved overrides/drafts exist.

## Requirements

1. Overrides for staff past their endDate must not render in the timetable
2. No database records deleted — stale overrides stay in DB (reversible if endDate is cleared)
3. Admin cannot save new shifts for staff past their endDate in edit mode
4. All downstream consumers (weekly hours, CSV export, CalendarDay) automatically fixed

## Approach

Filter at render time only. Add an `isStaffActiveOnDate()` utility and use it in two places: `applyOverrides()` (skip stale overrides) and `handleSaveChanges()` (prevent new stale data).

## Design

### 1. Utility Function: `isStaffActiveOnDate()`

Add to `src/hooks/useStaff.ts` (exported):

```typescript
export function isStaffActiveOnDate(staff: DatabaseStaffMember, date: Date): boolean {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  if (staff.startDate) {
    const start = new Date(staff.startDate);
    start.setHours(0, 0, 0, 0);
    if (checkDate < start) return false;
  }

  if (staff.endDate) {
    const end = new Date(staff.endDate);
    end.setHours(0, 0, 0, 0);
    if (checkDate >= end) return false;
  }

  return true;
}
```

This is the same logic used in `generateMonthSchedule()` and `getActiveStaffForDate()`, extracted as a single-staff check.

### 2. Filter in `applyOverrides()` — Calendar.tsx

Current signature (line ~301):
```typescript
const applyOverrides = (baseSchedule: MonthSchedule, overrides: Record<string, OverrideData>): MonthSchedule => {
```

Change to accept staff list:
```typescript
const applyOverrides = (baseSchedule: MonthSchedule, overrides: Record<string, OverrideData>, staffList: DatabaseStaffMember[]): MonthSchedule => {
```

Inside the override merge loop (before line 318), add:
```typescript
// Skip overrides for staff who are not active on this date
const staffMember = staffList.find(s => s.id === staffId);
if (staffMember && !isStaffActiveOnDate(staffMember, day.date)) {
  return; // Skip this override — staff has ended
}
```

Update the call site (line ~334):
```typescript
const updatedSchedule = applyOverrides(baseSchedule, manualOverrides, dynamicStaff);
```

### 3. Guard in `handleSaveChanges()` — Calendar.tsx

When building the overrides to save from `editBuffer`, skip entries for ended staff. Before adding to `newOverrides`:

```typescript
const staffMember = dynamicStaff.find(s => s.id === staffId);
if (staffMember && !isStaffActiveOnDate(staffMember, dayDate)) {
  continue; // Don't save override for ended staff
}
```

This prevents NEW stale data from being created. Existing stale data is harmless (filtered at render).

### 4. No Changes To

- **API routes** — GET/POST overrides, publish, discard unchanged
- **`generateMonthSchedule()`** — already correct (per-day filtering)
- **Database schema** — no changes
- **Weekly hours / CSV export / CalendarDay** — automatically fixed because they consume the filtered `schedule` object

## Files Changed

| File | Change | Priority |
|------|--------|----------|
| `src/hooks/useStaff.ts` | Add `isStaffActiveOnDate()` export | CRITICAL |
| `src/components/Calendar.tsx` | Filter in `applyOverrides()`, guard in `handleSaveChanges()` | CRITICAL |

## Edge Cases

- **endDate cleared later:** Stale overrides in DB become visible again (correct — that's why we don't delete them)
- **Staff with no DB record (legacy fallback in public view):** `staffList.find()` returns undefined → `staffMember` is falsy → skip the check → override renders (safe fallback)
- **Override for staffId not in dynamicStaff:** `staffMember` is undefined → skip the check → override renders (matches current behavior)
