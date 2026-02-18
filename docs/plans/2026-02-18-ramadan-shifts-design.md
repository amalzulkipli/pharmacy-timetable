# Ramadan Shift Types - Design Document

## Context

Farmasi Alde operates modified hours during Ramadan (approx Feb 28 - Mar 29, 2026):
- Store: 9:30 AM - 7 PM, closed 7-8 PM (iftar), reopen 8-9 PM
- 9h early shift becomes 8h on-site (09:15-17:15) + 1h remote evening (informational)
- 11h shift becomes 09:45-21:45 (same 11h work, shifted start)
- 9h late shift unchanged

## Approach

Add permanent Ramadan shift types to `SHIFT_DEFINITIONS` with a new "Ramadan" category in the shift dropdown. Admin manually assigns them via existing edit mode. No date-range logic, no new DB models.

## New Shift Definitions

```typescript
"9h_early_ramadan": {
  type: "8h+1h",
  timing: "early",
  startTime: "09:15",
  endTime: "17:15",
  workHours: 8,      // on-site hours only; +1h remote is informational
}
"11h_ramadan": {
  type: "11h",
  timing: null,
  startTime: "09:45",
  endTime: "21:45",
  workHours: 11,      // same work hours, shifted start
}
```

Separation constant: `RAMADAN_SHIFT_KEYS = ["9h_early_ramadan", "11h_ramadan"]`

## Dropdown UI

New "Ramadan" category between "Shifts" and "Custom":

```
Shifts
  11h (09:15-21:45)
  9h (09:15-19:15)
  ...
Ramadan
  8h+1h (09:15-17:15)
  11h (09:45-21:45)
Custom
  Custom Time...
```

Both desktop `<select>` and mobile `ShiftPickerBottomSheet` updated.

## Files to Modify

| File | Change |
|------|--------|
| `src/staff-data.ts` | Add 2 entries to `SHIFT_DEFINITIONS`, export `RAMADAN_SHIFT_KEYS` |
| `src/components/Calendar.tsx` | Desktop dropdown: filter Ramadan keys from "Shifts", add "Ramadan" optgroup |
| `src/components/mobile/ShiftPickerBottomSheet.tsx` | Mobile picker: filter Ramadan keys from "Shifts", add "Ramadan" section |

## No Changes Needed

- Database schema (new shifts are just new SHIFT_DEFINITIONS keys)
- API routes / `findShiftKey()` (matches by time+hours tuple, auto-works)
- `getShiftLabel()` (8h+1h hits default "Early Shift", 11h hits existing "Full Day Shift")
- Schedule generator (generic, no hardcoded shift types)
- CSV export (uses generic shift.startTime/endTime/workHours)
- `SHIFT_PATTERNS` / `DEFAULT_SHIFT_PATTERNS` (admin assigns Ramadan shifts manually)

## Display Behavior

| View | 9h_early_ramadan | 11h_ramadan |
|------|-----------------|-------------|
| Desktop dropdown | "8h+1h (09:15-17:15)" | "11h (09:45-21:45)" |
| Desktop card badge | "(8h)" | "(11h)" |
| Mobile picker label | "8h+1h Early" | "11h" |
| Mobile picker circle | "8h" | "11h" |
| Mobile card badge | "8h" | "11h" |
| Mobile card label | "Early Shift" | "Full Day Shift" |
| CSV export | "09:15 - 17:15 (8 hours)" | "09:45 - 21:45 (11 hours)" |

## Collision Check

`9h_early_ramadan` (09:15, 17:15, workHours=8) vs `7h_early` (09:15, 17:15, workHours=7): different workHours, no collision in `findShiftKey()`.
