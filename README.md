# Pharmacy Staff Scheduling System

A Next.js-based web application for managing pharmacy staff schedules with visual calendar interface, CSV/PDF export capabilities, and intelligent shift management.

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend:** Next.js 15.3.4 with React, TypeScript
- **Styling:** Tailwind CSS v4.1.11
- **PDF Generation:** Puppeteer v24.11.1 (server-side)
- **Build Tool:** Turbopack (Next.js dev mode)

### Project Structure
```
pharmacy-timetable/
├── src/
│   ├── app/
│   │   ├── api/generate-pdf/route.ts    # PDF generation API endpoint
│   │   ├── layout.tsx                   # Root layout component
│   │   ├── page.tsx                     # Main application page
│   │   └── globals.css                  # Global CSS styles
│   ├── components/
│   │   └── Calendar.tsx                 # Main calendar component
│   ├── lib/
│   │   └── schedule-generator.ts        # Schedule generation logic
│   ├── types/
│   │   └── schedule.ts                  # TypeScript type definitions
│   └── staff-data.ts                    # Staff configuration data
├── public/                              # Static assets
└── package.json                         # Dependencies and scripts
```

## 📅 Core Components

### 1. Calendar Component (`src/components/Calendar.tsx`)

**Purpose:** Main visual interface displaying monthly staff schedules in a grid layout.

**Key Features:**
- 7-column CSS Grid layout (Mon-Sun)
- Monthly navigation with previous/next buttons
- Color-coded staff cards for easy identification
- Responsive design with horizontal scrolling
- CSV and PDF export functionality

**Props Interface:**
```typescript
// No external props - uses internal state management
```

**State Management:**
```typescript
const [currentDate, setCurrentDate] = useState(new Date())
const [scheduleData, setScheduleData] = useState<ScheduleData>({})
```

**Grid Structure:**
- Header row: Day names (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- Calendar cells: 35-42 cells depending on month layout
- Each cell contains: Date, week number, staff shift cards

### 2. Schedule Generator (`src/lib/schedule-generator.ts`)

**Purpose:** Core business logic for generating pharmacy schedules with constraint satisfaction.

**Key Functions:**
```typescript
export function generateSchedule(
  year: number, 
  month: number, 
  staffData: StaffMember[]
): ScheduleData
```

**Scheduling Rules:**
- Each staff member works exactly 5 days per week
- Each staff member has exactly 2 consecutive days off per week
- Minimum coverage requirements must be met for all shifts
- Annual leave and holidays are respected
- OFF days can shift dynamically based on leave patterns

**Algorithm:**
1. Generate base schedule with fixed patterns
2. Apply annual leave constraints
3. Validate coverage requirements
4. Adjust OFF day patterns if needed to maintain 2-consecutive-day rule

### 3. PDF Generation API (`src/app/api/generate-pdf/route.ts`)

**Purpose:** Server-side PDF generation using Puppeteer for high-quality calendar exports.

**Endpoint:** `POST /api/generate-pdf`

**Request Body:**
```typescript
{
  html: string;           // Complete HTML with calendar
  styles: string;         // Extracted CSS styles
  title: string;          // PDF title (e.g., "Timetable July 2025")
  filename: string;       // Output filename
}
```

**PDF Features:**
- Multi-page pagination (2 weeks per page)
- A4 landscape format with optimized scaling
- Preserves web UI styling and colors
- Proper page breaks and headers
- Dynamic width calculation for content

**Technical Implementation:**
1. **DOM Capture:** Extract calendar HTML with all styling
2. **CSS Enhancement:** Add PDF-specific CSS for grid layout fixes
3. **Page Splitting:** Programmatically split calendar by weeks
4. **PDF Generation:** Use Puppeteer to render and export

## 🎨 Visual Design System

### Color Coding
Staff members are assigned distinct colors for easy identification:
- **Fatimah:** Blue (`bg-blue-50`, `text-blue-700`, `border-blue-200`)
- **Mathilda:** Green (`bg-green-50`, `text-green-700`, `border-green-200`)
- **Pah:** Purple (`bg-purple-50`, `text-purple-700`, `border-purple-200`)
- **Amal:** Pink (`bg-pink-50`, `text-pink-700`, `border-pink-200`)

### Layout System
- **Grid:** CSS Grid with `grid-cols-7` for week layout
- **Responsive:** Horizontal scrolling on smaller screens
- **Cards:** Rounded corners, subtle shadows, clear typography
- **Spacing:** Consistent padding and margins using Tailwind classes

## 📊 Data Models

### Staff Member
```typescript
interface StaffMember {
  id: string;
  name: string;
  color: string;
  shifts: ShiftPattern[];
  annualLeave: Date[];
  maxHoursPerWeek: number;
}
```

### Schedule Data
```typescript
interface ScheduleData {
  [dateKey: string]: DaySchedule;
}

interface DaySchedule {
  date: Date;
  dayOfWeek: number;
  weekNumber: number;
  shifts: StaffShift[];
}

interface StaffShift {
  staffId: string;
  staffName: string;
  startTime: string;
  endTime: string;
  duration: number;
  isOff: boolean;
  color: string;
}
```

## 🔄 Business Logic

### Schedule Generation Algorithm

1. **Base Pattern Creation:**
   - Each staff member assigned 5 working days
   - 2 consecutive OFF days per week
   - Default shift patterns applied

2. **Constraint Application:**
   - Annual leave dates marked as OFF
   - Holiday calendar integration
   - Minimum coverage validation

3. **Dynamic Adjustment:**
   - When someone takes leave, others' OFF days may shift
   - Maintains 2-consecutive-day OFF rule
   - Ensures pharmacy coverage requirements

### Critical Scheduling Rules

- **Coverage Requirement:** Minimum 2 staff members during opening hours
- **Consecutive OFF Days:** Each person must have exactly 2 consecutive days off
- **Flexibility:** OFF day patterns can change based on annual leave
- **Fairness:** Workload distribution attempts to be equitable

## 🖨️ Export Functionality

### CSV Export
- Downloads complete month schedule as CSV
- Filename format: `pharmacy-schedule-[Month]-[Year].csv`
- Includes all staff assignments with times

### PDF Export
- Multi-page landscape PDF with professional formatting
- Filename format: `Timetable-[Month]-[Year].pdf`
- Preserves visual styling from web interface
- 2 weeks per page for optimal readability

## 🔧 Development

### Getting Started
```bash
cd pharmacy-timetable
npm install
npm run dev
```

### Key Dependencies
```json
{
  "next": "15.3.4",
  "react": "19.0.0",
  "typescript": "^5",
  "tailwindcss": "^4.1.11",
  "puppeteer": "^24.11.1"
}
```

### Build and Deployment
```bash
npm run build
npm start
```

## 🐛 Technical Considerations

### PDF Generation Challenges
- **Tailwind v4.1.11 Compatibility:** Uses modern `oklch()` colors incompatible with html2canvas
- **Solution:** Puppeteer-based server-side rendering with CSS overrides
- **Grid Layout:** CSS Grid requires specific fixes for Puppeteer rendering
- **Performance:** PDF generation ~3-5 seconds per document

### Browser Compatibility
- Modern browsers with CSS Grid support
- Responsive design for mobile/tablet viewing
- Horizontal scrolling fallback for narrow screens

### Memory Management
- Puppeteer instances properly closed after PDF generation
- Schedule data regenerated only when month/year changes
- Efficient DOM manipulation for large calendars

## 🔮 Future Enhancements

### Planned Features
- **Staff Management:** Add/edit/remove staff members
- **Shift Templates:** Customizable shift patterns
- **Conflict Detection:** Visual warnings for scheduling conflicts
- **Holiday Management:** Integration with pharmacy holiday calendar
- **Reports:** Monthly summaries and analytics

### Technical Improvements
- **Database Integration:** Replace static data with persistent storage
- **Real-time Updates:** WebSocket for multi-user collaboration
- **Mobile App:** React Native companion app
- **Performance:** Optimized PDF generation with streaming

## 🎯 AI Context Notes

### For LLM Development
- **Schedule Logic:** Located in `schedule-generator.ts` - complex constraint satisfaction
- **PDF Issues:** Solved Tailwind v4/html2canvas incompatibility with Puppeteer
- **Grid Layout:** Uses CSS Grid extensively - require specific PDF rendering fixes
- **State Management:** React useState pattern - consider Redux for complexity growth
- **Type Safety:** Comprehensive TypeScript interfaces - extend for new features

### Key Patterns
- **Component Architecture:** Single-responsibility principle
- **Data Flow:** Unidirectional with clear prop interfaces
- **Error Handling:** Graceful degradation with user feedback
- **Performance:** Lazy loading and memoization where applicable

---

*Last Updated: January 2025*  
*Version: 1.0.0*
