# Brand Alignment Design

**Goal:** Make the timetable app (st.farmasialde.com/timetable) visually consistent with the main site (farmasialde.com) through a light-touch font and color alignment.

## Current State

| Property | farmasialde.com | Timetable app |
|----------|----------------|---------------|
| Body font | Nunito Sans | Inter |
| Heading font | Nunito | Inter |
| Brand color | #00aced | None (green/blue mix) |
| Text color | Warm grays | Tailwind default grays |
| Primary buttons | #00aced blue | Mixed green-600/blue-600 |

## Design Decisions

1. **Font swap** — Replace Inter with Nunito Sans (body) + Nunito (headings) via `next/font/google`
2. **Brand color** — Add `--color-brand: #00aced` and `--color-brand-dark: #0090c5` as Tailwind theme tokens
3. **Button colors** — Swap primary action buttons from `bg-green-600`/`bg-blue-600` to `bg-brand hover:bg-brand-dark`
4. **Text colors** — Keep current warm grays (#37352f family), no change needed
5. **Staff card colors** — DO NOT TOUCH. These are functional identity colors in `staff-data.ts`

## Scope

**Files to change (7):**
- `src/app/layout.tsx` — Font imports
- `src/app/globals.css` — Theme tokens + body font
- `src/components/Calendar.tsx` — Publish/Save Draft buttons
- `src/components/AppHeader.tsx` — Login icon hover
- `src/components/admin/StaffManagement.tsx` — Add Staff button
- `src/components/mobile/FloatingActionButton.tsx` — Publish FAB
- `src/components/mobile/MobileBottomBar.tsx` — Publish button

**Files explicitly excluded:**
- `src/staff-data.ts` — Staff identity colors
- Any status indicator colors (leave type badges, draft indicators)
- Any semantic colors (red for delete, yellow for warnings)
