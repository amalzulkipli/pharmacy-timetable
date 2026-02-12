# Pharmacy Staff Scheduling System

A Next.js-based web application for managing pharmacy staff schedules with visual calendar interface, CSV export capabilities, and intelligent shift management.

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend:** Next.js 15.5.11 with React 19, TypeScript
- **Database:** Prisma 6.19.1 with SQLite
- **Styling:** Tailwind CSS v4
- **Auth:** NextAuth v5 (JWT sessions, bcrypt)

### Project Structure
```
pharmacy-timetable/
├── src/
│   ├── app/
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
- CSV export functionality

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
  "next": "^15.5.11",
  "react": "^19.0.0",
  "typescript": "^5",
  "tailwindcss": "^4"
}
```

### Build and Deployment
```bash
npm run build
npm start
```

## 🐛 Technical Considerations

### Browser Compatibility
- Modern browsers with CSS Grid support
- Responsive design for mobile/tablet viewing
- Horizontal scrolling fallback for narrow screens

### Memory Management
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
- **Performance:** Caching and lazy loading optimizations

## 🎯 AI Context Notes

### For LLM Development
- **Schedule Logic:** Located in `schedule-generator.ts` - complex constraint satisfaction
- **Grid Layout:** Uses CSS Grid extensively
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
