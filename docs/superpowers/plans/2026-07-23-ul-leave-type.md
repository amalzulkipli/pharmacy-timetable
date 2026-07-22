# UL (Unpaid Leave) Leave Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UL (Unpaid Leave / Cuti Tanpa Gaji) as a selectable leave type, tracked history-only like EL — no balance, no entitlement, no DB migration.

**Architecture:** `leaveType` is an unconstrained `String?` in SQLite; the type set lives in TypeScript unions and the publish route's dispatch. We centralize the union as an exported `LeaveType`, add UL to both pickers, and extend the publish route's EL branch to also log UL history rows. Spec: `docs/superpowers/specs/2026-07-23-ul-leave-type-design.md`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Prisma 6 + SQLite, Tailwind v4.

## Global Constraints

- **No DB migration.** No changes to `prisma/schema.prisma`, no new `LeaveBalance` columns, no `docker-entrypoint.sh` changes.
- **No test framework exists.** Verification per task = `npm run lint` AND `npx tsc --noEmit`, both clean.
- **Commit messages:** plain conventional style, NO Claude/AI attribution, no Co-Authored-By trailers (user rule, overrides harness default).
- **Labels:** union member `'UL'`; picker/legend label `Unpaid Leave`; history short label `Unpaid`.
- **Branch:** all work on `feature/ul-leave-type` off `main` (Task 1 creates it). Do NOT commit code to `security/cve-2026-44578-nextjs-upgrade`.

---

### Task 1: Feature branch off main + carry docs over

**Files:**
- No source files. Git only.

**Interfaces:**
- Produces: branch `feature/ul-leave-type` containing `docs/superpowers/specs/2026-07-23-ul-leave-type-design.md` and this plan.

- [ ] **Step 1: Create the branch from main**

```bash
git checkout main && git pull --ff-only && git checkout -b feature/ul-leave-type
```

Expected: `Switched to a new branch 'feature/ul-leave-type'`. If `git pull` fails (offline), proceed from local `main`.

- [ ] **Step 2: Copy the spec + plan from the security branch (do NOT cherry-pick — avoids dragging unrelated history)**

```bash
git checkout security/cve-2026-44578-nextjs-upgrade -- docs/superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers && git commit -m "docs: add UL leave type design spec and implementation plan"
```

---

### Task 2: Centralized `LeaveType` union (includes `'UL'`) + replace all inline unions

**Files:**
- Modify: `src/types/schedule.ts` (~line 37)
- Modify: `src/components/Calendar.tsx` (lines ~6, 118, 322, 407, 411, 1613, 1897)
- Modify: `src/lib/schedule-generator.ts` (lines ~2-9, 103)

**Interfaces:**
- Produces: `export type LeaveType = 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' | 'UL';` from `@/types/schedule`, used by later tasks.
- CRITICAL runtime change: `Calendar.tsx:1613` array gains `'UL'` — without it the mobile bottom sheet cannot map a UL tap to `leave_ul`.

- [ ] **Step 1: Add the exported type in `src/types/schedule.ts`**

Insert as a top-level declaration immediately above the interface containing `staffShifts`:

```typescript
export type LeaveType = 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' | 'UL';
```

Then replace the field (line ~37):

```typescript
// OLD
      leaveType?: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT';
// NEW
      leaveType?: LeaveType;
```

- [ ] **Step 2: Update `src/components/Calendar.tsx` — import + 6 union sites**

Import (line 6):

```typescript
// OLD
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift } from '../types/schedule';
// NEW
import type { MonthSchedule, DaySchedule, ShiftDefinition, StaffMember, ReplacementShift, LeaveType } from '../types/schedule';
```

Line 118:

```typescript
// OLD
  type OverrideData = Record<string, { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' } | ReplacementShift[]>;
// NEW
  type OverrideData = Record<string, { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: LeaveType } | ReplacementShift[]>;
```

Line 322:

```typescript
// OLD
            const override = overrides[dayKey][staffId] as { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' };
// NEW
            const override = overrides[dayKey][staffId] as { shift: ShiftDefinition | null; isLeave: boolean; leaveType?: LeaveType };
```

Line 407:

```typescript
// OLD
        let leaveType: 'AL' | 'RL' | 'EL' | 'ML' | 'MAT' | undefined = undefined;
// NEW
        let leaveType: LeaveType | undefined = undefined;
```

Line 411:

```typescript
// OLD
          leaveType = value.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL' | 'ML' | 'MAT';
// NEW
          leaveType = value.split('_')[1].toUpperCase() as LeaveType;
```

Line 1613 (RUNTIME array — add `'UL'`):

```typescript
// OLD
      if (['AL', 'RL', 'EL', 'ML', 'MAT'].includes(shiftKey)) {
// NEW
      if (['AL', 'RL', 'EL', 'ML', 'MAT', 'UL'].includes(shiftKey)) {
```

Line 1897:

```typescript
// OLD
      displayLeaveType = editValue.split('_')[1].toUpperCase() as 'AL' | 'RL' | 'EL' | 'ML' | 'MAT';
// NEW
      displayLeaveType = editValue.split('_')[1].toUpperCase() as LeaveType;
```

- [ ] **Step 3: Update `src/lib/schedule-generator.ts`**

Add `LeaveType` to the existing type import (lines 2–9):

```typescript
// OLD
import type {
  MonthSchedule,
  DaySchedule,
  PublicHoliday,
  WeeklyHourSummary,
  ShiftDefinition,
  StaffMember
} from '../types/schedule';
// NEW
import type {
  MonthSchedule,
  DaySchedule,
  PublicHoliday,
  WeeklyHourSummary,
  ShiftDefinition,
  StaffMember,
  LeaveType
} from '../types/schedule';
```

Line 103 (this union was stale — missing ML/MAT — centralizing fixes it):

```typescript
// OLD
    const staffShifts: { [staffId: string]: { shift: ShiftDefinition | null; isOverride: boolean; isLeave: boolean; leaveType?: 'AL' | 'RL' | 'EL' } } = {};
// NEW
    const staffShifts: { [staffId: string]: { shift: ShiftDefinition | null; isOverride: boolean; isLeave: boolean; leaveType?: LeaveType } } = {};
```

- [ ] **Step 4: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: both pass with no new errors. (If `tsc --noEmit` reports PRE-EXISTING errors unrelated to these files, note them and proceed; do not fix unrelated code.)

- [ ] **Step 5: Commit**

```bash
git add src/types/schedule.ts src/components/Calendar.tsx src/lib/schedule-generator.ts
git commit -m "refactor: centralize LeaveType union and add UL member"
```

---

### Task 3: UL option in desktop and mobile pickers

**Files:**
- Modify: `src/components/Calendar.tsx` (Leave `<optgroup>`, ~line 1240)
- Modify: `src/components/mobile/ShiftPickerBottomSheet.tsx` (`LEAVE_OPTIONS`, lines 18–24)

**Interfaces:**
- Consumes: Task 2's `'UL'` entry in the `Calendar.tsx:1613` array (mobile tap → `leave_ul` buffer value).
- Produces: pickers emit `leave_ul` / key `'UL'`; the existing generic `leave_*` parse handlers need no changes.

- [ ] **Step 1: Desktop — add option inside the Leave optgroup in `Calendar.tsx`**

```tsx
// OLD
      <optgroup label="Leave">
        <option value="leave_al">Annual Leave</option>
        <option value="leave_rl">Replacement Leave</option>
        <option value="leave_el">Emergency Leave</option>
        <option value="leave_ml">Medical Leave</option>
        <option value="leave_mat">Maternity Leave (98 days)...</option>
      </optgroup>
// NEW
      <optgroup label="Leave">
        <option value="leave_al">Annual Leave</option>
        <option value="leave_rl">Replacement Leave</option>
        <option value="leave_el">Emergency Leave</option>
        <option value="leave_ml">Medical Leave</option>
        <option value="leave_ul">Unpaid Leave</option>
        <option value="leave_mat">Maternity Leave (98 days)...</option>
      </optgroup>
```

(UL before MAT so the modal-triggering MAT option stays last.)

- [ ] **Step 2: Mobile — add UL row to `LEAVE_OPTIONS` in `ShiftPickerBottomSheet.tsx`**

```typescript
// OLD
const LEAVE_OPTIONS = [
  { key: 'AL', label: 'Annual Leave', color: 'text-blue-600', hasModal: false },
  { key: 'RL', label: 'Replacement Leave', color: 'text-green-600', hasModal: false },
  { key: 'EL', label: 'Emergency Leave', color: 'text-orange-600', hasModal: false },
  { key: 'ML', label: 'Medical Leave', color: 'text-red-600', hasModal: false },
  { key: 'MAT', label: 'Maternity Leave (98 days)', color: 'text-blue-600', hasModal: true },
];
// NEW
const LEAVE_OPTIONS = [
  { key: 'AL', label: 'Annual Leave', color: 'text-blue-600', hasModal: false },
  { key: 'RL', label: 'Replacement Leave', color: 'text-green-600', hasModal: false },
  { key: 'EL', label: 'Emergency Leave', color: 'text-orange-600', hasModal: false },
  { key: 'ML', label: 'Medical Leave', color: 'text-red-600', hasModal: false },
  { key: 'UL', label: 'Unpaid Leave', color: 'text-gray-600', hasModal: false },
  { key: 'MAT', label: 'Maternity Leave (98 days)', color: 'text-blue-600', hasModal: true },
];
```

No icon change needed — the icon selector (`ShiftPickerBottomSheet.tsx:269`) defaults non-ML/MAT keys to the `Calendar` icon, matching AL/RL/EL.

- [ ] **Step 3: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Calendar.tsx src/components/mobile/ShiftPickerBottomSheet.tsx
git commit -m "feat: add Unpaid Leave (UL) option to desktop and mobile shift pickers"
```

---

### Task 4: Publish route — record UL history + warn on unknown types

**Files:**
- Modify: `src/app/api/overrides/publish/route.ts` (lines ~103–124)

**Interfaces:**
- Consumes: `change.leaveType` strings from drafts (now possibly `'UL'`).
- Produces: `LeaveHistory` rows with `leaveType: 'UL'`, `status: 'approved'`; NO `LeaveBalance` writes for UL.

- [ ] **Step 1: Replace the EL branch and add the unknown-type warning**

The current code (verbatim, lines 103–124):

```typescript
        } else if (change.leaveType === 'EL') {
          // EL doesn't have balance tracking, just record history
          const existingHistory = await tx.leaveHistory.findFirst({
            where: {
              staffId: change.staffId,
              date: change.date,
              status: 'approved',
            },
          });

          if (!existingHistory) {
            await tx.leaveHistory.create({
              data: {
                staffId: change.staffId,
                date: change.date,
                leaveType: 'EL',
                status: 'approved',
              },
            });
          }
        }
      }
```

Replace with:

```typescript
        } else if (change.leaveType === 'EL' || change.leaveType === 'UL') {
          // EL/UL have no balance tracking, just record history
          const existingHistory = await tx.leaveHistory.findFirst({
            where: {
              staffId: change.staffId,
              date: change.date,
              status: 'approved',
            },
          });

          if (!existingHistory) {
            await tx.leaveHistory.create({
              data: {
                staffId: change.staffId,
                date: change.date,
                leaveType: change.leaveType,
                status: 'approved',
              },
            });
          }
        } else {
          // Unknown leave types were previously dropped with no trace
          console.warn(
            `publish: unknown leaveType "${change.leaveType}" for staff ${change.staffId} on ${change.date.toISOString().slice(0, 10)} — no history or balance recorded`
          );
        }
      }
```

Note the hardcoded `leaveType: 'EL'` becomes `leaveType: change.leaveType` — required so UL rows are labeled UL.

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/overrides/publish/route.ts
git commit -m "feat: record UL leave history on publish; warn on unknown leave types"
```

---

### Task 5: Labels — history list + leave overview legend

**Files:**
- Modify: `src/components/admin/StaffLeaveCard.tsx` (`getLeaveTypeLabel`, lines 47–62)
- Modify: `src/components/admin/LeaveOverview.tsx` (info footer, lines 214–226)

**Interfaces:**
- Consumes: `LeaveHistory.leaveType === 'UL'` rows from Task 4.

- [ ] **Step 1: Add UL case in `StaffLeaveCard.tsx`**

```typescript
// OLD
    case 'MAT':
      return 'Maternity';
    default:
      return type;
// NEW
    case 'MAT':
      return 'Maternity';
    case 'UL':
      return 'Unpaid';
    default:
      return type;
```

- [ ] **Step 2: Add UL line to the legend in `LeaveOverview.tsx`**

```tsx
// OLD
          <strong>MAT:</strong> Maternity Leave (98 days). Select from calendar to auto-create leave period.
        </p>
// NEW
          <strong>MAT:</strong> Maternity Leave (98 days). Select from calendar to auto-create leave period.
          <br />
          <strong>UL:</strong> Unpaid Leave (Cuti Tanpa Gaji). No entitlement — recorded in leave history only.
        </p>
```

- [ ] **Step 3: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/StaffLeaveCard.tsx src/components/admin/LeaveOverview.tsx
git commit -m "feat: label UL leave in history list and leave overview legend"
```

---

### Task 6: End-to-end verification

**Files:**
- None modified. Verification only.

- [ ] **Step 1: Full static checks + production build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: all pass. Build must complete (standalone output).

- [ ] **Step 2: Manual flow (dev server)**

```bash
npm run dev
```

Then at `http://localhost:3000/timetable`:
1. Log in → Admin → Timetable tab → Edit mode.
2. Desktop dropdown on any staff/day: "Unpaid Leave" appears under Leave; select it → cell shows "UL" in orange.
3. Mobile viewport (≤768px): tap a staff card → bottom sheet Leave section shows "UL Unpaid Leave" with gray Calendar icon; select it.
4. Save changes (draft) → Publish month.
5. Leave tab → that staff's card → View History: entry labeled "Unpaid" on the chosen date; AL/RL/ML/MAT balances unchanged.
6. Publish the same month again → history entry NOT duplicated.

- [ ] **Step 3: Confirm nothing leaked into the security branch**

```bash
git log --oneline security/cve-2026-44578-nextjs-upgrade..HEAD
```

Expected: only this feature's commits (docs + Tasks 2–5).
