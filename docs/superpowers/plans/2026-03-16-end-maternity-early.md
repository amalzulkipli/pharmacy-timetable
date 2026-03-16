# End Maternity Leave Early Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin to end a staff member's maternity leave early, deleting all MAT entries from the return date onward and correcting leave balances.

**Architecture:** New API route `POST /api/leave/maternity/end-early` performs atomic cleanup across 5 tables in one transaction. UI button on StaffLeaveCard opens a confirmation dialog with date picker.

**Tech Stack:** Next.js 15 App Router, Prisma 6 + SQLite, React 19, date-fns

**Spec:** `docs/superpowers/specs/2026-03-16-end-maternity-early-design.md`

**Note:** No test framework configured. Verification via `npm run lint`, `npm run build`, and manual testing.

---

## Chunk 1: API Endpoint

### Task 1: Create end-early API route

**Files:**
- Create: `src/app/api/leave/maternity/end-early/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/leave/maternity/end-early/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { subDays, startOfDay } from 'date-fns';

// POST /api/leave/maternity/end-early - End maternity leave early
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, returnDate } = body;

    if (!staffId || !returnDate) {
      return NextResponse.json(
        { error: 'Missing required fields: staffId, returnDate' },
        { status: 400 }
      );
    }

    const returnDateObj = startOfDay(new Date(returnDate));

    // Step 1: Find active maternity period
    const activePeriod = await prisma.maternityLeavePeriod.findFirst({
      where: { staffId, status: 'active' },
    });

    if (!activePeriod) {
      return NextResponse.json(
        { error: 'No active maternity leave period found for this staff member' },
        { status: 404 }
      );
    }

    // Step 2: Validate returnDate
    const periodStart = startOfDay(activePeriod.startDate);
    const periodEnd = startOfDay(activePeriod.endDate);

    if (returnDateObj <= periodStart) {
      return NextResponse.json(
        { error: 'Return date must be after the maternity start date' },
        { status: 400 }
      );
    }

    if (returnDateObj > periodEnd) {
      return NextResponse.json(
        { error: 'Return date must be within the maternity period' },
        { status: 400 }
      );
    }

    // Execute all cleanup in one transaction
    const result = await prisma.$transaction(async (tx) => {
      // Step 3: Delete ScheduleOverride MAT entries from returnDate onward
      const deletedOverrides = await tx.scheduleOverride.deleteMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
        },
      });

      // Step 4: Delete ScheduleDraft MAT entries from returnDate onward
      const deletedDrafts = await tx.scheduleDraft.deleteMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
        },
      });

      // Step 5: Clean up orphaned DraftMonth records (only affected months)
      if (deletedDrafts.count > 0) {
        // Compute affected months from returnDate through original endDate
        const affectedMonths = new Set<string>();
        let cursor = new Date(returnDateObj);
        while (cursor <= periodEnd) {
          affectedMonths.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }

        for (const monthKey of affectedMonths) {
          const [yearStr, monthStr] = monthKey.split('-');
          const y = parseInt(yearStr);
          const m = parseInt(monthStr);
          const startOfMonthDate = new Date(y, m - 1, 1);
          const endOfMonthDate = new Date(y, m, 0, 23, 59, 59);
          const remainingDrafts = await tx.scheduleDraft.count({
            where: {
              date: { gte: startOfMonthDate, lte: endOfMonthDate },
            },
          });
          if (remainingDrafts === 0) {
            await tx.draftMonth.deleteMany({
              where: { year: y, month: m },
            });
          }
        }
      }

      // Step 6: Count and delete LeaveHistory MAT entries from returnDate onward
      const historyToDelete = await tx.leaveHistory.findMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
          status: 'approved',
        },
        select: { id: true, date: true },
      });

      // Group by year for balance adjustment
      const countByYear = new Map<number, number>();
      for (const entry of historyToDelete) {
        const year = entry.date.getFullYear();
        countByYear.set(year, (countByYear.get(year) || 0) + 1);
      }

      // Delete the history entries
      if (historyToDelete.length > 0) {
        await tx.leaveHistory.deleteMany({
          where: {
            id: { in: historyToDelete.map(h => h.id) },
          },
        });
      }

      // Step 7: Decrement LeaveBalance.matUsed per year
      for (const [year, count] of countByYear) {
        await tx.leaveBalance.updateMany({
          where: { staffId, year },
          data: { matUsed: { decrement: count } },
        });
      }

      // Step 8: Update MaternityLeavePeriod
      const newEndDate = startOfDay(subDays(returnDateObj, 1));
      await tx.maternityLeavePeriod.update({
        where: { id: activePeriod.id },
        data: {
          endDate: newEndDate,
          status: 'ended_early',
        },
      });

      return {
        daysRemoved: deletedOverrides.count + deletedDrafts.count,
        historyRemoved: historyToDelete.length,
        newEndDate: newEndDate.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      daysRemoved: result.daysRemoved,
      historyRemoved: result.historyRemoved,
      newEndDate: result.newEndDate,
    });
  } catch (error) {
    console.error('Error ending maternity leave early:', error);
    return NextResponse.json(
      { error: 'Failed to end maternity leave early' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Update schema comment**

In `prisma/schema.prisma`, update the status comment on the MaternityLeavePeriod model:

Change:
```
  status    String   @default("active") // "active" | "cancelled"
```
To:
```
  status    String   @default("active") // "active" | "cancelled" | "ended_early"
```

- [ ] **Step 3: Verify lint and build**

```bash
npm run lint && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leave/maternity/end-early/route.ts prisma/schema.prisma
git commit -m "Add POST /api/leave/maternity/end-early endpoint"
```

---

## Chunk 2: UI — End Early Button and Dialog

### Task 2: Add End Early UI to StaffLeaveCard

**Files:**
- Modify: `src/components/admin/StaffLeaveCard.tsx`

The maternity section is at lines 158-188. We need to:
1. Add `onEndMaternityEarly` callback prop
2. Add state for the confirmation dialog
3. Add "End Early" button next to "Active" badge
4. Add confirmation dialog with date picker
5. Show "Ended Early" badge when period status is `ended_early`

- [ ] **Step 1: Update MaternityPeriod interface and props**

In `src/components/admin/StaffLeaveCard.tsx`, update the MaternityPeriod interface (line 16-19):

```typescript
interface MaternityPeriod {
  startDate: string;
  endDate: string;
  status?: string;
}
```

Update StaffLeaveCardProps (line 21-30) to add the callback:

```typescript
interface StaffLeaveCardProps {
  staffId: string;
  staffName: string;
  staffRole: string;
  al: { entitlement: number; used: number; remaining: number };
  rl: { earned: number; used: number; remaining: number };
  ml: { entitlement: number; used: number; remaining: number };
  mat?: { entitlement: number; used: number; remaining: number; activePeriod?: MaternityPeriod };
  history: LeaveHistoryEntry[];
  onEndMaternityEarly?: (staffId: string, returnDate: string) => Promise<void>;
}
```

- [ ] **Step 2: Add imports and state**

Add to imports (line 3-6):

```typescript
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { AVATAR_COLORS } from '@/staff-data';
import { Calendar } from '@/components/ui/calendar';
```

Add state inside the component function (after existing state):

```typescript
  const [showEndEarlyDialog, setShowEndEarlyDialog] = useState(false);
  const [endEarlyDate, setEndEarlyDate] = useState<Date | undefined>(undefined);
  const [isEndingEarly, setIsEndingEarly] = useState(false);
```

- [ ] **Step 3: Add handleEndEarly function**

Add after the state declarations:

```typescript
  const handleEndEarly = async () => {
    if (!endEarlyDate || !onEndMaternityEarly) return;
    try {
      setIsEndingEarly(true);
      await onEndMaternityEarly(staffId, format(endEarlyDate, 'yyyy-MM-dd'));
      setShowEndEarlyDialog(false);
      setEndEarlyDate(undefined);
    } catch {
      // Error handled by parent
    } finally {
      setIsEndingEarly(false);
    }
  };
```

- [ ] **Step 4: Replace the maternity leave section**

Replace the maternity section (lines 158-188) with:

```tsx
        {/* Maternity Leave - only show if there's an active/ended period or days used */}
        {mat && (mat.activePeriod || mat.used > 0) && (
          <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700 font-medium">Maternity Leave</span>
              <div className="flex items-center gap-2">
                {mat.activePeriod?.status === 'ended_early' ? (
                  <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Ended Early
                  </span>
                ) : mat.activePeriod ? (
                  <>
                    {onEndMaternityEarly && (
                      <button
                        onClick={() => setShowEndEarlyDialog(true)}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                      >
                        End Early
                      </button>
                    )}
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            {mat.activePeriod ? (
              <div className="text-sm text-blue-600">
                {format(parseISO(mat.activePeriod.startDate), 'd MMM yyyy')} - {format(parseISO(mat.activePeriod.endDate), 'd MMM yyyy')}
              </div>
            ) : (
              <>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${Math.min(matPercentUsed, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-blue-400 mt-1.5">
                  <span>{Math.floor(mat.used)} used</span>
                  <span>{mat.entitlement} total</span>
                </div>
              </>
            )}

            {/* End Early Confirmation Dialog */}
            {showEndEarlyDialog && mat.activePeriod && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 max-w-[400px] w-full overflow-hidden">
                  <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="text-[15px] font-bold text-slate-900">End Maternity Leave Early</div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">{staffName}</div>
                  </div>
                  <div className="px-6 pt-5 pb-6">
                    <p className="text-[13px] text-slate-500 mb-4 leading-normal">
                      Select the return-to-work date. All maternity entries from this date onward will be removed.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <Calendar
                        mode="single"
                        selected={endEarlyDate}
                        onSelect={setEndEarlyDate}
                        defaultMonth={new Date(mat.activePeriod.startDate)}
                        disabled={(date) => {
                          const start = new Date(mat.activePeriod!.startDate);
                          const end = new Date(mat.activePeriod!.endDate);
                          return date <= start || date > end;
                        }}
                        className="!bg-transparent !p-0 w-full [--cell-size:2.25rem]"
                        modifiersClassNames={{
                          selected: "!bg-orange-600 !text-white !font-bold",
                        }}
                      />
                    </div>
                    {endEarlyDate && mat.activePeriod && (
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-[10px] px-4 py-3 mb-5">
                        <svg className="w-4 h-4 text-orange-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span className="text-[13px] text-orange-800">
                          {differenceInDays(new Date(mat.activePeriod.endDate), endEarlyDate) + 1} days will be removed
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleEndEarly}
                        disabled={!endEarlyDate || isEndingEarly}
                        className="flex-1 px-5 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-[10px] hover:bg-orange-700 disabled:opacity-50 transition-colors"
                      >
                        {isEndingEarly ? 'Ending...' : 'Confirm End Early'}
                      </button>
                      <button
                        onClick={() => { setShowEndEarlyDialog(false); setEndEarlyDate(undefined); }}
                        className="px-4 py-2.5 border border-slate-200 text-slate-500 font-semibold text-sm rounded-[10px] hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 5: Update the component function signature to accept the new prop**

The component function destructuring needs `onEndMaternityEarly`. Find the function definition and add it:

```typescript
export default function StaffLeaveCard({ staffId, staffName, staffRole, al, rl, ml, mat, history, onEndMaternityEarly }: StaffLeaveCardProps) {
```

- [ ] **Step 6: Verify lint and build**

```bash
npm run lint && npm run build
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/StaffLeaveCard.tsx
git commit -m "Add End Early button and dialog to StaffLeaveCard"
```

---

### Task 3: Wire up onEndMaternityEarly in LeaveOverview

**Files:**
- Modify: `src/components/admin/LeaveOverview.tsx`

- [ ] **Step 1: Update MaternityPeriod interface in LeaveOverview**

In `src/components/admin/LeaveOverview.tsx`, update the `MaternityPeriod` interface (lines 8-11) to include `status`:

```typescript
interface MaternityPeriod {
  startDate: string;
  endDate: string;
  status?: string;
}
```

- [ ] **Step 2: Add the handler function and pass to StaffLeaveCard**

Add a `handleEndMaternityEarly` function that calls the API and refreshes data. Pass it as the `onEndMaternityEarly` prop.

The handler:

```typescript
  const handleEndMaternityEarly = async (staffId: string, returnDate: string) => {
    const response = await fetch(apiUrl('/api/leave/maternity/end-early'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, returnDate }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to end maternity leave early');
    }

    // Refresh leave data
    await fetchData();
  };
```

Pass to each `StaffLeaveCard`:

```tsx
<StaffLeaveCard
  // ... existing props
  onEndMaternityEarly={handleEndMaternityEarly}
/>
```

- [ ] **Step 3: Update balances API to return period status**

In `src/app/api/leave/balances/route.ts`, the maternity period query (line 52-53) filters `status: 'active'`. We also need to return `ended_early` periods so the UI can show the "Ended Early" badge. Update the query:

Change:
```typescript
    const maternityPeriods = await prisma.maternityLeavePeriod.findMany({
      where: { status: 'active' },
    });
```

To:
```typescript
    const maternityPeriods = await prisma.maternityLeavePeriod.findMany({
      where: { status: { in: ['active', 'ended_early'] } },
    });
```

And include `status` in the map (lines 58-63):

```typescript
    maternityPeriods.forEach((period) => {
      maternityMap.set(period.staffId, {
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        status: period.status,
      });
    });
```

Update the `MaternityPeriod` type in the same file to include status:

```typescript
interface MaternityPeriod {
  startDate: string;
  endDate: string;
  status: string;
}
```

- [ ] **Step 4: Verify lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/LeaveOverview.tsx src/app/api/leave/balances/route.ts
git commit -m "Wire up end maternity early in LeaveOverview, return period status in balances API"
```

---

## Chunk 3: Verification

### Task 4: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify End Early flow for Fatimah**

1. Go to `/timetable/admin` → Leave tab
2. Find Fatimah's card — should show "Maternity Leave" with "Active" badge and date range
3. Click "End Early"
4. Select April 1, 2026 as the return date
5. Verify info pill shows the number of days to remove
6. Click "Confirm End Early"
7. Verify badge changes to "Ended Early"
8. Verify date range shows updated end date (March 31)
9. Go to Timetable tab → navigate to April
10. Verify Fatimah shows regular shifts (not MAT) from April 1 onward
11. Navigate to March — verify Fatimah still shows MAT for March

- [ ] **Step 3: Verify validation**

1. Try to end early with a date before the maternity start date — should get error
2. Try to end early again for Fatimah — should get 404 (period no longer active)

- [ ] **Step 4: Final build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit and push**

```bash
git push
```
