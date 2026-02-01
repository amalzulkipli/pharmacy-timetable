'use client';

import { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Menu, X, Edit, Save, Check, Calendar as CalendarIcon } from 'lucide-react';
import type { DaySchedule } from '@/types/schedule';

type BottomBarState = 'view' | 'edit' | 'draft';

interface MobileBottomBarProps {
  // State
  state: BottomBarState;

  // Day selector props
  days: DaySchedule[];
  selectedIndex: number;
  onSelectDay: (index: number) => void;
  onGoToToday: () => void;

  // Menu props
  onMenuOpen: () => void;

  // Edit mode props
  onCancelEdit: () => void;
  onSaveChanges: () => void;

  // Draft mode props
  onEnterEditMode: () => void;
  onPublish: () => void;

  // Only show edit controls for admin
  isAdmin: boolean;
}

export default function MobileBottomBar({
  state,
  days,
  selectedIndex,
  onSelectDay,
  onGoToToday,
  onMenuOpen,
  onCancelEdit,
  onSaveChanges,
  onEnterEditMode,
  onPublish,
  isAdmin,
}: MobileBottomBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Auto-scroll to selected date
  useEffect(() => {
    if (selectedButtonRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = selectedButtonRef.current;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      const isOutOfView = buttonRect.left < containerRect.left || buttonRect.right > containerRect.right;

      if (isOutOfView) {
        button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Render left action button based on state
  const renderLeftAction = () => {
    // Public mode: no menu, no left action
    if (!isAdmin) {
      return null;
    }

    if (state === 'edit') {
      // Cancel button in edit mode
      return (
        <button
          onClick={onCancelEdit}
          className="flex-shrink-0 flex items-center justify-center w-12 h-12 text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
          aria-label="Cancel editing"
        >
          <X size={22} />
        </button>
      );
    }

    // Menu button in view/draft mode (admin only)
    return (
      <button
        onClick={onMenuOpen}
        className="flex-shrink-0 flex items-center justify-center w-12 h-12 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>
    );
  };

  // Render right action button(s) based on state
  const renderRightAction = () => {
    if (!isAdmin) {
      // Public mode: just TODAY button
      return (
        <button
          onClick={onGoToToday}
          className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-1.5 text-blue-500 hover:bg-blue-50 active:bg-blue-100 rounded-xl transition-colors"
        >
          <CalendarIcon size={20} />
          <span className="text-[10px] font-semibold mt-0.5">TODAY</span>
        </button>
      );
    }

    if (state === 'edit') {
      // Save button in edit mode
      return (
        <button
          onClick={onSaveChanges}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <Save size={18} />
          <span>Save</span>
        </button>
      );
    }

    if (state === 'draft') {
      // Edit + Publish buttons in draft mode
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={onEnterEditMode}
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
            aria-label="Edit"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={onPublish}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            <Check size={18} />
            <span>Publish</span>
          </button>
        </div>
      );
    }

    // View mode: TODAY + Edit (icon-only) buttons
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onGoToToday}
          className="flex-shrink-0 flex flex-col items-center justify-center px-2 py-1 text-blue-500 hover:bg-blue-50 active:bg-blue-100 rounded-xl transition-colors"
        >
          <CalendarIcon size={18} />
          <span className="text-[10px] font-semibold">TODAY</span>
        </button>
        <button
          onClick={onEnterEditMode}
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
          aria-label="Edit schedule"
        >
          <Edit size={18} />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 shadow-lg z-30">
      <div className="flex items-center h-16 px-2 gap-1">
        {/* Left: Menu or Cancel */}
        {renderLeftAction()}

        {/* Center: Scrollable dates */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
        >
          <div className="flex gap-0.5 px-1">
            {days.map((day, idx) => {
              const isSelected = idx === selectedIndex;
              const isAdjacentMonth = !day.isCurrentMonth;
              const isToday = format(day.date, 'yyyy-MM-dd') === todayStr;

              let buttonClasses = 'flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl transition-colors min-w-[44px]';
              if (isSelected) {
                buttonClasses += ' bg-blue-500 text-white';
              } else if (isToday) {
                buttonClasses += ' bg-blue-100 text-blue-600';
              } else if (isAdjacentMonth) {
                buttonClasses += ' text-gray-300';
              } else {
                buttonClasses += ' text-gray-500 active:bg-gray-100';
              }

              return (
                <button
                  key={format(day.date, 'yyyy-MM-dd')}
                  ref={isSelected ? selectedButtonRef : null}
                  onClick={() => onSelectDay(idx)}
                  className={buttonClasses}
                >
                  <span className="text-[10px] font-semibold uppercase">{format(day.date, 'EEE')}</span>
                  <span className="text-lg font-bold leading-tight">{format(day.date, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Action buttons */}
        {renderRightAction()}
      </div>

      {/* Safe area padding for notched devices */}
      <div className="h-safe" />
    </div>
  );
}
