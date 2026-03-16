# Staff End Date Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `endDate` field to Staff so staff members can be phased out on a specific date while preserving historical timetable data.

**Architecture:** Add nullable `endDate` column to Staff table. Filter staff per-day in `generateMonthSchedule()` using `date < endDate`. API returns all active staff (no endDate filtering at API level). Admin UI gets "End Service" button with date picker dialog.

**Tech Stack:** Next.js 15, Prisma 6 + SQLite, React 19, TypeScript, Tailwind CSS v4, date-fns

**Spec:** `docs/superpowers/specs/2026-03-16-staff-end-date-design.md`

**Note:** This project has no test framework. Verification steps use `npm run lint` and `npm run build`.

---

## Chunk 1: Database & API Layer

### Task 1: Add endDate to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:28` (Staff model)

- [ ] **Step 1: Add endDate field to Staff model**

In `prisma/schema.prisma`, add after line 28 (`startDate`):

```prisma
  endDate        DateTime? // Staff disappears from timetable on this date onward
```

- [ ] **Step 2: Run Prisma migration**

```bash
npx prisma migrate dev --name add_staff_end_date
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify migration**

```bash
npx prisma studio
```

Open Staff table — confirm `endDate` column exists with null values for all existing rows.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "Add endDate field to Staff schema"
```

---

### Task 2: Add Docker entrypoint migration

**Files:**
- Modify: `docker-entrypoint.sh:38` (after existing custom_time_fields migration)

- [ ] **Step 1: Add idempotent migration block**

In `docker-entrypoint.sh`, add after the `custom_time_fields` migration block (after line 38, before `echo "Schema up to date."`):

```bash
# Migration: add_staff_end_date
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

- [ ] **Step 2: Commit**

```bash
git add docker-entrypoint.sh
git commit -m "Add endDate Docker migration for production DB"
```

---

### Task 3: Update GET /api/staff response

**Files:**
- Modify: `src/app/api/staff/route.ts:29` (GET response transform)

- [ ] **Step 1: Add endDate to GET response**

In `src/app/api/staff/route.ts`, in the `transformed` map (line 21-34), add after the `startDate` line (line 29):

```typescript
      endDate: s.endDate?.toISOString() || null,
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/staff/route.ts
git commit -m "Include endDate in GET /api/staff response"
```

---

### Task 4: Update GET/PUT /api/staff/[staffId]

**Files:**
- Modify: `src/app/api/staff/[staffId]/route.ts:30-39` (GET response)
- Modify: `src/app/api/staff/[staffId]/route.ts:51` (PUT destructuring)
- Modify: `src/app/api/staff/[staffId]/route.ts:54-61` (PUT updateData)
- Modify: `src/app/api/staff/[staffId]/route.ts:81-90` (PUT response)

- [ ] **Step 1: Add fields to GET response**

In `src/app/api/staff/[staffId]/route.ts`, replace the GET response object (lines 30-39) with:

```typescript
    return NextResponse.json({
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
      weeklyHours: staff.weeklyHours,
      defaultOffDays: parseOffDays(staff.defaultOffDays),
      alEntitlement: staff.alEntitlement,
      mlEntitlement: staff.mlEntitlement,
      startDate: staff.startDate?.toISOString() || null,
      endDate: staff.endDate?.toISOString() || null,
      colorIndex: staff.colorIndex,
      isActive: staff.isActive,
    });
```

- [ ] **Step 2: Add startDate and endDate to PUT destructuring**

Replace line 51:

```typescript
    const { name, role, weeklyHours, defaultOffDays, alEntitlement, mlEntitlement, isActive } = body;
```

With:

```typescript
    const { name, role, weeklyHours, defaultOffDays, alEntitlement, mlEntitlement, isActive, startDate, endDate } = body;
```

- [ ] **Step 3: Add startDate/endDate handling and validation to PUT updateData**

After line 61 (`if (isActive !== undefined) updateData.isActive = isActive;`), add the date handling and validation. Place this **before** the `prisma.staff.update()` call:

```typescript
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    // Validate: endDate must be after startDate if both are set
    // Check against existing DB values when only one date is being updated
    if (startDate !== undefined || endDate !== undefined) {
      const existing = await prisma.staff.findUnique({ where: { staffId }, select: { startDate: true, endDate: true } });
      const effectiveStart = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing?.startDate;
      const effectiveEnd = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing?.endDate;
      if (effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }
```

- [ ] **Step 4: Add fields to PUT response**

Replace the PUT response object (lines 81-90) with:

```typescript
    return NextResponse.json({
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
      weeklyHours: staff.weeklyHours,
      defaultOffDays: parseOffDays(staff.defaultOffDays),
      alEntitlement: staff.alEntitlement,
      mlEntitlement: staff.mlEntitlement,
      startDate: staff.startDate?.toISOString() || null,
      endDate: staff.endDate?.toISOString() || null,
      colorIndex: staff.colorIndex,
      isActive: staff.isActive,
    });
```

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/staff/[staffId]/route.ts
git commit -m "Accept endDate in PUT, align GET/PUT response shapes"
```

---

## Chunk 2: Client Data Layer & Filtering

### Task 5: Update useStaff hook

**Files:**
- Modify: `src/hooks/useStaff.ts:9-15` (DatabaseStaffMember interface)
- Modify: `src/hooks/useStaff.ts:47-69` (API transform)
- Modify: `src/hooks/useStaff.ts:86-109` (staff merge)
- Modify: `src/hooks/useStaff.ts:119-136` (getActiveStaffForDate)

- [ ] **Step 1: Add endDate to DatabaseStaffMember interface**

In `src/hooks/useStaff.ts`, add after line 10 (`startDate?: Date | null;`):

```typescript
  endDate?: Date | null;
```

- [ ] **Step 2: Add endDate to API response type and transform**

In the `data.map` callback (lines 47-69), add `endDate` to the inline type (after line 53):

```typescript
          endDate?: string | null;
```

And add to the returned object (after line 64):

```typescript
          endDate: s.endDate ? new Date(s.endDate) : null,
```

- [ ] **Step 3: Add endDate to legacy staff merge**

In the legacy staff merge (lines 88-99), add after line 93 (`startDate: dbRecord?.startDate || null,`):

```typescript
        endDate: dbRecord?.endDate || null,
```

- [ ] **Step 4: Add endDate check to getActiveStaffForDate**

In `getActiveStaffForDate()` (lines 119-136), add endDate boundary check. After line 134 (`return checkDate >= staffStart;`), change the function to:

```typescript
export function getActiveStaffForDate(
  staffList: DatabaseStaffMember[],
  date: Date
): DatabaseStaffMember[] {
  return staffList.filter(staff => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Check startDate lower bound
    if (staff.startDate) {
      const staffStart = new Date(staff.startDate);
      staffStart.setHours(0, 0, 0, 0);
      if (checkDate < staffStart) return false;
    }

    // Check endDate upper bound (exclusive)
    if (staff.endDate) {
      const staffEnd = new Date(staff.endDate);
      staffEnd.setHours(0, 0, 0, 0);
      if (checkDate >= staffEnd) return false;
    }

    return true;
  });
}
```

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useStaff.ts
git commit -m "Add endDate to staff data layer and filtering"
```

---

### Task 6: Add endDate filter to schedule generator

**Files:**
- Modify: `src/lib/schedule-generator.ts:105-116` (activeStaff filter)

- [ ] **Step 1: Add endDate check to staff filter**

In `src/lib/schedule-generator.ts`, modify the `activeStaff` filter (lines 106-116). After the startDate check (line 115: `return checkDate >= staffStart;`), restructure to:

```typescript
    // Filter staff who are active on this date
    const activeStaff = staffList.filter(staff => {
      const dbStaff = staff as DatabaseStaffMember;
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      // Check startDate lower bound
      if (dbStaff.startDate) {
        const staffStart = new Date(dbStaff.startDate);
        staffStart.setHours(0, 0, 0, 0);
        if (checkDate < staffStart) return false;
      }

      // Check endDate upper bound (exclusive)
      if (dbStaff.endDate) {
        const staffEnd = new Date(dbStaff.endDate);
        staffEnd.setHours(0, 0, 0, 0);
        if (checkDate >= staffEnd) return false;
      }

      return true;
    });
```

- [ ] **Step 2: Verify DatabaseStaffMember import includes endDate**

Check that the `DatabaseStaffMember` type imported from `useStaff.ts` (or defined locally) includes `endDate`. Since `schedule-generator.ts` uses `staff as DatabaseStaffMember`, the type must have the field. It's imported from `@/hooks/useStaff` — confirm this import exists. If not, add:

```typescript
import type { DatabaseStaffMember } from '@/hooks/useStaff';
```

- [ ] **Step 3: Verify lint and build pass**

```bash
npm run lint && npm run build
```

Expected: No errors. This is the critical verification — build confirms all types align.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schedule-generator.ts
git commit -m "Filter staff by endDate in schedule generation"
```

---

## Chunk 3: Admin UI

### Task 7: Add End Service UI to StaffManagement

**Files:**
- Modify: `src/components/admin/StaffManagement.tsx`

This is the largest task. Changes:
1. Add `endDate` to Staff interface
2. Add "End Service" dialog state
3. Add `handleEndService` / `handleClearEndDate` functions
4. Add End Service dialog component
5. Add end date badge + edit/clear to staff cards
6. Rename "Remove" to "Set Inactive"

- [ ] **Step 1: Add endDate to Staff interface and import CalendarOff icon**

At line 4, add `CalendarOff` to the lucide-react import:

```typescript
import { Users, Plus, Pencil, Trash2, Save, X, Loader2, CalendarOff } from 'lucide-react';
```

At line 8-18, add `endDate` to the Staff interface:

```typescript
interface Staff {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
  alEntitlement: number;
  mlEntitlement: number;
  startDate?: string | null;
  endDate?: string | null;
  colorIndex?: number | null;
  isActive: boolean;
}
```

- [ ] **Step 2: Add End Service dialog state**

Inside the `StaffManagement` component (after line 95 `const [isSaving, setIsSaving] = useState(false);`), add:

```typescript
  // End Service dialog state
  const [endServiceStaffId, setEndServiceStaffId] = useState<string | null>(null);
  const [endServiceDate, setEndServiceDate] = useState('');
  const [isEndingService, setIsEndingService] = useState(false);
```

- [ ] **Step 3: Add handleEndService and handleClearEndDate functions**

After `handleDelete` (after line 194), add:

```typescript
  const handleEndService = async () => {
    if (!endServiceStaffId || !endServiceDate) return;

    try {
      setIsEndingService(true);
      const response = await fetch(apiUrl(`/api/staff/${endServiceStaffId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: endServiceDate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set end date');
      }

      await fetchStaff();
      setEndServiceStaffId(null);
      setEndServiceDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set end date');
    } finally {
      setIsEndingService(false);
    }
  };

  const handleClearEndDate = async (staffId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/staff/${staffId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: null }),
      });

      if (!response.ok) throw new Error('Failed to clear end date');
      await fetchStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear end date');
    }
  };

  const openEndServiceDialog = (s: Staff) => {
    setEndServiceStaffId(s.id);
    setEndServiceDate(s.endDate ? s.endDate.split('T')[0] : '');
  };

  // Calculate last working day display (endDate - 1 day)
  const formatLastDay = (endDateStr: string) => {
    const d = new Date(endDateStr);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  };
```

- [ ] **Step 4: Rename "Remove" to "Set Inactive" in handleDelete**

Change line 182:

```typescript
    if (!confirm('Are you sure you want to set this staff member as inactive?')) return;
```

- [ ] **Step 5: Add End Service dialog component**

After the error display block (after line 234, before the Add/Edit Form comment), add:

```tsx
      {/* End Service Dialog */}
      {endServiceStaffId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">End Service</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set the date when this staff member will stop appearing in the timetable.
              They will still appear on dates before this.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endServiceDate}
                onChange={(e) => setEndServiceDate(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-gray-900"
              />
              {endServiceDate && (
                <p className="mt-2 text-sm text-gray-500">
                  Last day on timetable: <span className="font-medium text-gray-700">{formatLastDay(endServiceDate)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEndService}
                disabled={!endServiceDate || isEndingService}
                className="flex-1 px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {isEndingService ? 'Saving...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setEndServiceStaffId(null); setEndServiceDate(''); }}
                className="flex-1 px-4 py-3 border rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Update MobileStaffListCard**

In `MobileStaffListCard` (lines 25-87):

a) Add `onEndService` prop:

```typescript
function MobileStaffListCard({
  staff,
  onEdit,
  onDelete,
  onEndService,
  onClearEndDate,
}: {
  staff: Staff;
  onEdit: (s: Staff) => void;
  onDelete: (id: string) => void;
  onEndService: (s: Staff) => void;
  onClearEndDate: (id: string) => void;
}) {
```

b) Add end date badge after the Stats Grid (after the `</div>` closing the grid, before Action Buttons), and add End Service / Clear buttons:

```tsx
      {/* End Date Badge */}
      {staff.endDate && (
        <div className="flex items-center justify-between mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <span className="text-sm text-orange-700">
            Ends: {new Date(staff.endDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={() => onClearEndDate(staff.id)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}
```

c) Update Action Buttons section — add End Service button and rename Remove:

```tsx
      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(staff)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg font-medium text-sm min-h-[48px]"
        >
          <Pencil className="w-5 h-5" />
          Edit
        </button>
        <button
          onClick={() => onEndService(staff)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 text-orange-600 rounded-lg font-medium text-sm min-h-[48px]"
        >
          <CalendarOff className="w-5 h-5" />
          {staff.endDate ? 'Edit End' : 'End Service'}
        </button>
        <button
          onClick={() => onDelete(staff.id)}
          className="flex items-center justify-center gap-2 px-3 py-3 bg-red-50 text-red-600 rounded-lg font-medium text-sm min-h-[48px]"
          title="Set Inactive"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
```

- [ ] **Step 7: Pass new props to MobileStaffListCard**

In the mobile rendering section (lines 353-364), update the `MobileStaffListCard` usage:

```tsx
        <div className="space-y-4">
          {staff.filter((s) => s.isActive).map((s) => (
            <MobileStaffListCard
              key={s.id}
              staff={s}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onEndService={openEndServiceDialog}
              onClearEndDate={handleClearEndDate}
            />
          ))}
        </div>
```

- [ ] **Step 8: Update desktop table — add End Date column and End Service button**

a) Add column header after "ML Days" (line 375):

```tsx
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
```

b) In table body rows, add end date cell after ML Days cell (after line 387):

```tsx
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {s.endDate ? (
                        <div className="flex items-center gap-2">
                          <span className="text-orange-600 font-medium">
                            {new Date(s.endDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => handleClearEndDate(s.id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                            title="Clear end date"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
```

c) In the Actions column, add End Service button after Edit button (after line 396):

```tsx
                        <button
                          onClick={() => openEndServiceDialog(s)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title={s.endDate ? 'Edit End Date' : 'End Service'}
                        >
                          <CalendarOff className="w-4 h-4" />
                        </button>
```

d) Update the Deactivate button title (line 400):

```tsx
                          title="Set Inactive"
```

- [ ] **Step 9: Verify lint and build pass**

```bash
npm run lint && npm run build
```

Expected: No errors. Build confirms all TypeScript types are correct.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/StaffManagement.tsx
git commit -m "Add End Service UI with date picker, rename Remove to Set Inactive"
```

---

## Chunk 4: Documentation & Verification

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add endDate to Staff model documentation**

In the Database Schema section, update the Staff description:

```
- `Staff` - Staff members with entitlements (alEntitlement, mlEntitlement), startDate/endDate for timetable visibility
```

- [ ] **Step 2: Add endDate to Important Implementation Details**

Add a new numbered item after the existing list:

```markdown
14. **Staff End Date:** `endDate` field on Staff controls when a staff member stops appearing in the timetable. `endDate` is exclusive — staff visible when `date < endDate`. Filtering happens in `generateMonthSchedule()` (source of truth) and `getActiveStaffForDate()` (unused utility). The API returns all active staff regardless of endDate; date filtering is client-side so historical months still show ended staff. Admin sets via "End Service" button in Staff Management tab.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document endDate field in CLAUDE.md"
```

---

### Task 9: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify End Service flow**

1. Go to `/timetable/admin` → Staff tab
2. Click End Service (CalendarOff icon) on a staff member
3. Set end date to a date in the current month
4. Confirm — verify badge shows "Ends: [date]"
5. Go to Timetable tab — verify staff disappears from dates after endDate
6. Navigate to a past month — verify staff still appears
7. Go back to Staff tab — click Edit End on the same staff → verify date is pre-filled
8. Click Clear — verify badge disappears and staff appears on all future dates again

- [ ] **Step 3: Verify Set Inactive flow still works**

1. Click the trash icon on a staff member
2. Confirm dialog says "Are you sure you want to set this staff member as inactive?"
3. Confirm — staff disappears from the list

- [ ] **Step 4: Verify validation**

1. Edit a staff member — set startDate to April 1
2. Click End Service — set endDate to March 1 (before startDate)
3. Verify error message: "End date must be after start date"

- [ ] **Step 5: Verify mobile view**

1. Resize browser to < 768px
2. Verify End Service button and end date badge render correctly on mobile cards
3. Verify End Service dialog is usable on mobile

- [ ] **Step 6: Final build check**

```bash
npm run build
```

Expected: Build succeeds with no errors.
