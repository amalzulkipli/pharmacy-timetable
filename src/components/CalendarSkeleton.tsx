import { Skeleton } from './ui/Skeleton';

/**
 * CalendarSkeleton renders both mobile and desktop skeletons simultaneously.
 * CSS media queries toggle visibility, avoiding JavaScript detection flash.
 */
export default function CalendarSkeleton() {
  return (
    <>
      {/* Desktop skeleton - hidden on mobile */}
      <div className="hidden md:block min-h-screen bg-gray-100">
        <DesktopCalendarSkeleton />
      </div>
      {/* Mobile skeleton - hidden on desktop */}
      <div className="md:hidden min-h-screen bg-gray-100">
        <MobileCalendarSkeleton />
      </div>
    </>
  );
}

/**
 * Desktop skeleton: Header + Toolbar + 7-column grid with staff card placeholders
 */
function DesktopCalendarSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9" />
            <Skeleton className="w-32 h-5" variant="text" />
          </div>
          {/* Tabs placeholder */}
          <div className="flex items-center gap-6">
            <Skeleton className="w-20 h-5" variant="text" />
            <Skeleton className="w-16 h-5" variant="text" />
            <Skeleton className="w-14 h-5" variant="text" />
          </div>
          {/* Right buttons */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8" variant="circular" />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-screen-2xl mx-auto p-4">
        {/* Toolbar skeleton */}
        <div className="mb-4 flex items-center justify-between">
          {/* Left: Month/Year selectors */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-24 h-8" />
            <Skeleton className="w-16 h-8" />
          </div>
          {/* Right: Navigation + action buttons */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-6 h-6" variant="circular" />
            <Skeleton className="w-14 h-7" />
            <Skeleton className="w-6 h-6" variant="circular" />
            <div className="w-px h-4 bg-gray-200 mx-2" />
            <Skeleton className="w-16 h-8" />
            <Skeleton className="w-16 h-8" />
            <Skeleton className="w-24 h-8" />
          </div>
        </div>

        {/* Calendar grid skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
              <div
                key={day}
                className={`py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 ${
                  idx > 0 ? 'border-l border-gray-200' : ''
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid cells - 5 weeks */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, idx) => (
              <DaySkeletonCell key={idx} idx={idx} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Single day cell skeleton with date number and staff card placeholders
 */
function DaySkeletonCell({ idx }: { idx: number }) {
  const isFirstCol = idx % 7 === 0;
  return (
    <div
      className={`border-t border-gray-100 p-3 min-h-[200px] bg-white ${
        !isFirstCol ? 'border-l border-gray-100' : ''
      }`}
    >
      {/* Date number and week label */}
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="w-6 h-6" variant="circular" />
        <Skeleton className="w-8 h-4" variant="text" />
      </div>
      {/* Staff card skeletons - 4 per day */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <StaffCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Staff card skeleton for desktop view
 */
function StaffCardSkeleton() {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <Skeleton className="w-16 h-3 mb-1.5" variant="text" />
      <Skeleton className="w-full h-3 mb-1" variant="text" />
      <Skeleton className="w-full h-1.5 mt-1" />
    </div>
  );
}

/**
 * Mobile skeleton: Header + Controls + Day header + Staff cards + Bottom bar
 */
function MobileCalendarSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Skeleton className="w-9 h-9" />
          <Skeleton className="w-36 h-5" variant="text" />
        </div>
        <Skeleton className="w-8 h-8" variant="circular" />
      </div>

      {/* Controls: Month/Year + Week nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        {/* Month/Year dropdowns */}
        <div className="flex gap-2">
          <Skeleton className="w-24 h-9" />
          <Skeleton className="w-16 h-9" />
        </div>
        {/* Week navigation */}
        <Skeleton className="w-32 h-9" />
      </div>

      {/* Day header */}
      <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <Skeleton className="w-40 h-6" variant="text" />
          <Skeleton className="w-16 h-4" variant="text" />
        </div>
      </div>

      {/* Staff cards */}
      <div className="px-4 space-y-3 mt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <MobileStaffCardSkeleton key={i} />
        ))}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-pb">
        <div className="flex items-center justify-between">
          {/* Menu button */}
          <Skeleton className="w-10 h-10" />
          {/* Day selector */}
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="w-9 h-12" />
            ))}
          </div>
          {/* Action button */}
          <Skeleton className="w-20 h-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile staff card skeleton
 */
function MobileStaffCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Skeleton className="w-10 h-10" variant="circular" />
        {/* Name and label */}
        <div className="flex-1">
          <Skeleton className="w-28 h-4 mb-1.5" variant="text" />
          <Skeleton className="w-20 h-3" variant="text" />
        </div>
        {/* Badge */}
        <Skeleton className="w-12 h-7" />
      </div>
      {/* Progress bar */}
      <Skeleton className="w-full h-2 mt-3" />
      {/* Time */}
      <div className="flex items-center gap-1.5 mt-2">
        <Skeleton className="w-4 h-4" variant="circular" />
        <Skeleton className="w-28 h-3" variant="text" />
      </div>
    </div>
  );
}
