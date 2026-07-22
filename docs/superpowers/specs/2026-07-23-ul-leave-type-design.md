# Design: Add UL (Unpaid Leave) leave type

**Date:** 2026-07-23
**Requested by:** Kak Fatimah (FAST operational lead) — "Dalam sistem Amal mcm mana nak tambah jenis leave UL"
**Status:** Approved by Amal (design), pending implementation

## Context

UL = Unpaid Leave (Cuti Tanpa Gaji), codified for FABC staff in April 2026 (see wiki:
`concepts/al-after-mc-no-stacking-fabc.md`). The timetable system currently supports
AL / RL / EL / ML / MAT; UL is missing from the leave pickers.

`leaveType` is an unconstrained `String?` in SQLite — the type set lives only in
TypeScript unions and the publish route's dispatch logic. Today, any leave type the
publish route doesn't recognize is **silently dropped** (no history row, no balance
change) while still rendering in the calendar.

## Decisions

1. **Tracking model: history-only, mirroring EL.** UL has no entitlement or balance
   columns. On publish it writes a `LeaveHistory` row only. Payroll counts UL days
   from history. **No DB migration.**
2. **Manual option only.** The anti-stacking policy (AL/EL immediately after MC
   reclassifies to UL) stays a human judgment call — no automation, no warnings.

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/types/schedule.ts` | Export shared `LeaveType` union including `'UL'` |
| 2 | `src/components/Calendar.tsx` | Replace 6 inline leave-type unions with `LeaveType`; add `Unpaid Leave (UL)` option to the Leave `<optgroup>` (~line 1237, value `leave_ul`) |
| 3 | `src/lib/schedule-generator.ts` | Replace stale narrower union (line ~103, missing ML/MAT) with `LeaveType` |
| 4 | `src/components/mobile/ShiftPickerBottomSheet.tsx` | Add UL entry to `LEAVE_OPTIONS` (key, label, color; no modal) |
| 5 | `src/app/api/overrides/publish/route.ts` | Extend the EL branch (~line 103) to also match `'UL'` — deduped `LeaveHistory` row, no balance columns touched |
| 6 | `src/app/api/overrides/publish/route.ts` | Add `console.warn` for unknown leave types in the final fall-through (behavior otherwise unchanged) |
| 7 | `src/components/admin/StaffLeaveCard.tsx` | `getLeaveTypeLabel()`: add `UL → 'Unpaid Leave'` |
| 8 | `src/components/admin/LeaveOverview.tsx` | Add UL line to the info-footer legend |

Calendar cell display needs no work — leave types render as their code in the shared
orange leave styling (`text-orange-600`).

## Error handling

- Publish idempotency: the EL history branch dedupes by staffId + date + status;
  UL inherits this, so re-publishing a month cannot double-log UL days.
- Unknown leave types: still a no-op on publish, but now logged via `console.warn`
  so the failure is diagnosable.

## Testing

No test framework configured in this repo. Verification:

1. `npm run lint` passes.
2. Manual flow, desktop + mobile: pick UL → save draft → publish → `LeaveHistory`
   row exists, `LeaveBalance` untouched, calendar shows "UL" in orange.
3. Re-publish same month → no duplicate history row.

## Out of scope

- Anti-stacking automation or soft warnings
- UL counters / balance columns / any Prisma migration
- Backfilling historical UL days (e.g. the 8 Jul 2026 "Esok kita UL" day) — admin
  can enter them manually via the picker once shipped
