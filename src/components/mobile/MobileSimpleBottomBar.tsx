'use client';

import { Menu } from 'lucide-react';

interface MobileSimpleBottomBarProps {
  onMenuOpen: () => void;
}

export default function MobileSimpleBottomBar({
  onMenuOpen,
}: MobileSimpleBottomBarProps) {
  return (
    <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 shadow-lg z-30">
      <div className="flex items-center h-16 px-4">
        {/* Menu button */}
        <button
          onClick={onMenuOpen}
          className="flex items-center justify-center w-12 h-12 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Safe area padding for notched devices */}
      <div className="h-safe" />
    </div>
  );
}
