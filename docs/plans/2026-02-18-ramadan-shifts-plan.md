# Ramadan Shift Types - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Ramadan shift types (8h+1h and 11h) to the shift dropdown under a new "Ramadan" category.

**Architecture:** Add new entries to the existing `SHIFT_DEFINITIONS` object with a `RAMADAN_SHIFT_KEYS` constant to separate them in dropdown UI. No new DB models, no schedule generator changes — admin assigns Ramadan shifts manually via existing edit mode.

**Tech Stack:** TypeScript, React, Next.js, Tailwind CSS, lucide-react (Moon icon)

**Design doc:** `docs/plans/2026-02-18-ramadan-shifts-design.md`

---

### Task 1: Add Ramadan shift definitions to staff-data.ts

**Files:**
- Modify: `src/staff-data.ts:103-152` (SHIFT_DEFINITIONS object)

**Step 1: Add Ramadan shifts and export key list**

After the existing `"7h_late"` entry (line ~152) and before the closing `}`, add:

```typescript
  "9h_early_ramadan": {
    type: "8h+1h",
    timing: "early",
    startTime: "09:15",
    endTime: "17:15",
    workHours: 8,
  },
  "11h_ramadan": {
    type: "11h",
    timing: null,
    startTime: "09:45",
    endTime: "21:45",
    workHours: 11,
  },
```

After the `SHIFT_DEFINITIONS` export (after the closing `};`), add:

```typescript
// Keys for Ramadan-specific shifts (used to separate them in dropdown UI)
export const RAMADAN_SHIFT_KEYS = new Set(["9h_early_ramadan", "11h_ramadan"]);
```

**Step 2: Verify build**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/staff-data.ts
git commit -m "Add Ramadan shift definitions (8h+1h early, 11h)"
```

---

### Task 2: Update desktop shift dropdown with Ramadan category

**Files:**
- Modify: `src/components/Calendar.tsx:1216-1248` (ShiftDropdown function)
- Modify: `src/components/Calendar.tsx:5` (imports)

**Step 1: Update import**

In the import from `'../staff-data'` (line 5), add `RAMADAN_SHIFT_KEYS`:

```typescript
import { STAFF_MEMBERS, SHIFT_DEFINITIONS, RAMADAN_SHIFT_KEYS, getStaffColors } from '../staff-data';
```

**Step 2: Update ShiftDropdown to split Shifts and Ramadan optgroups**

Replace the `<optgroup label="Shifts">` block (lines 1234-1239) with:

```tsx
      <optgroup label="Shifts">
        {Object.keys(SHIFT_DEFINITIONS).filter(key => !RAMADAN_SHIFT_KEYS.has(key)).map(key => {
          const shift = SHIFT_DEFINITIONS[key];
          return <option key={key} value={key}>{`${shift.type} (${shift.startTime}-${shift.endTime})`}</option>
        })}
      </optgroup>
      <optgroup label="Ramadan">
        {Object.keys(SHIFT_DEFINITIONS).filter(key => RAMADAN_SHIFT_KEYS.has(key)).map(key => {
          const shift = SHIFT_DEFINITIONS[key];
          return <option key={key} value={key}>{`${shift.type} (${shift.startTime}-${shift.endTime})`}</option>
        })}
      </optgroup>
```

**Step 3: Verify build**

Run: `npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/Calendar.tsx
git commit -m "Add Ramadan category to desktop shift dropdown"
```

---

### Task 3: Update mobile shift picker with Ramadan section

**Files:**
- Modify: `src/components/mobile/ShiftPickerBottomSheet.tsx:4-5` (imports)
- Modify: `src/components/mobile/ShiftPickerBottomSheet.tsx:175-216` (Shifts section)

**Step 1: Update imports**

Add `Moon` to the lucide-react import (line 4):

```typescript
import { Check, X, Clock, Calendar, Stethoscope, Baby, Moon } from 'lucide-react';
```

Add `RAMADAN_SHIFT_KEYS` to the staff-data import (line 5):

```typescript
import { SHIFT_DEFINITIONS, RAMADAN_SHIFT_KEYS, AVATAR_COLORS } from '@/staff-data';
```

**Step 2: Filter existing Shifts section to exclude Ramadan keys**

In the Shifts section (line 181), change:

```tsx
{Object.entries(SHIFT_DEFINITIONS).map(([key, shift]) => {
```

to:

```tsx
{Object.entries(SHIFT_DEFINITIONS).filter(([key]) => !RAMADAN_SHIFT_KEYS.has(key)).map(([key, shift]) => {
```

**Step 3: Add Ramadan section after the Shifts section closing `</div>` (after line 216)**

Insert a new section between the Shifts `</div>` and the Leave section. It follows the exact same pattern as the Shifts section but with Moon icon and amber accent color for selected state:

```tsx
          {/* Ramadan Section */}
          <div className="px-2">
            <div className="flex items-center gap-2 px-4 py-2 mt-2">
              <Moon className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Ramadan</span>
            </div>
            {Object.entries(SHIFT_DEFINITIONS).filter(([key]) => RAMADAN_SHIFT_KEYS.has(key)).map(([key, shift]) => {
              const isSelected = currentValue === key;
              const label = shift.timing
                ? `${shift.type} ${shift.timing.charAt(0).toUpperCase() + shift.timing.slice(1)}`
                : shift.type;

              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-amber-50 text-amber-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <span className={`text-sm font-medium ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>
                        {shift.workHours}h
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="font-medium">{label}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-amber-600" />}
                </button>
              );
            })}
          </div>
```

Key differences from the regular Shifts section:
- Moon icon instead of Clock
- Amber color scheme (`text-amber-400/600`, `bg-amber-50/100`, `text-amber-700/900`) instead of blue
- Category label "Ramadan" in amber

**Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/mobile/ShiftPickerBottomSheet.tsx
git commit -m "Add Ramadan category to mobile shift picker"
```

---

### Task 4: Final verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no warnings

**Step 2: Manual testing checklist**

Run: `npm run dev`

Desktop:
- [ ] Enter edit mode on any month
- [ ] Click any staff shift dropdown
- [ ] Verify "Ramadan" optgroup appears between "Shifts" and "Custom"
- [ ] Verify "8h+1h (09:15-17:15)" and "11h (09:45-21:45)" options are listed
- [ ] Select "8h+1h (09:15-17:15)" → card shows "(8h)" badge, correct times
- [ ] Select "11h (09:45-21:45)" → card shows "(11h)" badge, correct times
- [ ] Regular shifts still work as before
- [ ] Save draft → publish → verify shifts persist

Mobile (resize to < 768px):
- [ ] Tap staff card to open shift picker bottom sheet
- [ ] Verify "Ramadan" section with Moon icon appears between "Shifts" and "Leave"
- [ ] Verify amber color for Ramadan section header
- [ ] Select Ramadan 8h+1h → check label "Early Shift", badge "8h", times "09:15-17:15"
- [ ] Select Ramadan 11h → check label "Full Day Shift", badge "11h", times "09:45-21:45"
- [ ] Selected Ramadan shift shows amber highlight (not blue)

**Step 3: Commit all (if any fixes needed)**

```bash
git add -A
git commit -m "Add Ramadan shift types with categorized dropdown"
```
