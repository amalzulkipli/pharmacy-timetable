# Brand Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the timetable app's fonts and primary button colors with the farmasialde.com main site.

**Architecture:** Swap Inter font to Nunito Sans + Nunito via `next/font/google`, add brand color tokens to Tailwind v4 theme, then update 4 component files to use brand color classes instead of hardcoded green/blue.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4 (`@theme inline`), `next/font/google`

---

### Task 1: Swap fonts in layout.tsx

**Files:**
- Modify: `src/app/layout.tsx:2,6,30`

**Step 1: Replace Inter import with Nunito Sans + Nunito**

Change line 2 from:
```typescript
import { Inter } from "next/font/google";
```
to:
```typescript
import { Nunito, Nunito_Sans } from "next/font/google";
```

**Step 2: Replace font initialization**

Change line 6 from:
```typescript
const inter = Inter({ subsets: ["latin"] });
```
to:
```typescript
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
```

**Step 3: Update body className**

Change line 30 from:
```tsx
<body className={inter.className}>
```
to:
```tsx
<body className={`${nunitoSans.variable} ${nunito.variable} font-sans`}>
```

---

### Task 2: Add brand color tokens and font to globals.css

**Files:**
- Modify: `src/app/globals.css:11-16,28`

**Step 1: Add brand colors and update font-sans in @theme inline**

Change lines 11-16 from:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```
to:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: #00aced;
  --color-brand-dark: #0090c5;
  --font-sans: var(--font-nunito-sans), "Nunito Sans", sans-serif;
  --font-mono: var(--font-geist-mono);
}
```

**Step 2: Update body font-family**

Change line 28 from:
```css
font-family: 'Inter', sans-serif;
```
to:
```css
font-family: var(--font-nunito-sans), "Nunito Sans", sans-serif;
```

**Step 3: Verify build**

Run: `cd /root/projects/pharmacy-timetable && npm run build`
Expected: Build succeeds. The Nunito Sans font should appear in the preload link.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "style: swap Inter to Nunito Sans + brand color tokens"
```

---

### Task 3: Update Calendar.tsx buttons to brand color

**Files:**
- Modify: `src/components/Calendar.tsx:972,986,994,1001`

**Step 1: Update Save Draft button (line 972)**

Change:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
```
to:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors"
```

**Step 2: Update Publish button (line 986)**

Change:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
```
to:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors"
```

**Step 3: Update Edit button in draft state (line 994)**

Change:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
```
to:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors"
```

**Step 4: Update Edit Mode button (line 1001)**

Change:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
```
to:
```tsx
className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors"
```

**Note:** Do NOT change the modal Save/Apply buttons (lines 1308, 1386) — those are internal form actions, not primary navigation actions.

---

### Task 4: Update AppHeader.tsx login hover color

**Files:**
- Modify: `src/components/AppHeader.tsx:82`

**Step 1: Change login button hover to brand color**

Change line 82:
```tsx
className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
```
to:
```tsx
className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-brand transition-colors"
```

---

### Task 5: Update StaffManagement.tsx buttons

**Files:**
- Modify: `src/components/admin/StaffManagement.tsx:217,332`

**Step 1: Update Add Staff button (line 217)**

Change:
```tsx
className={`flex items-center justify-center bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 ${
```
to:
```tsx
className={`flex items-center justify-center bg-brand text-white font-medium rounded-lg hover:bg-brand-dark ${
```

**Step 2: Update Save button in form (line 332)**

Change:
```tsx
className={`flex items-center justify-center bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 ${
```
to:
```tsx
className={`flex items-center justify-center bg-brand text-white font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 ${
```

---

### Task 6: Update mobile components

**Files:**
- Modify: `src/components/mobile/FloatingActionButton.tsx:64`
- Modify: `src/components/mobile/MobileBottomBar.tsx:141`

**Step 1: Update FAB Publish button (FloatingActionButton.tsx line 64)**

Change:
```tsx
className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors text-sm font-medium"
```
to:
```tsx
className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-full shadow-lg hover:bg-brand-dark transition-colors text-sm font-medium"
```

**Step 2: Update MobileBottomBar Publish button (MobileBottomBar.tsx line 141)**

Change:
```tsx
className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:bg-green-800 transition-colors"
```
to:
```tsx
className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-dark active:bg-brand-dark transition-colors"
```

---

### Task 7: Final verification and commit

**Step 1: Build**

Run: `cd /root/projects/pharmacy-timetable && npm run build`
Expected: Build succeeds with no errors.

**Step 2: Commit all component changes**

```bash
git add src/components/Calendar.tsx src/components/AppHeader.tsx src/components/admin/StaffManagement.tsx src/components/mobile/FloatingActionButton.tsx src/components/mobile/MobileBottomBar.tsx
git commit -m "style: apply brand color to primary action buttons"
```

**Step 3: Push**

```bash
git push origin main
```

This triggers auto-deploy via Dokploy webhook.
