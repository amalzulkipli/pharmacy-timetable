'use client';

import { useState } from 'react';
import { Edit, MoreVertical, X, Check, Trash2 } from 'lucide-react';

interface FloatingActionButtonProps {
  hasDraft: boolean;
  onEdit: () => void;
  onDiscard: () => void;
  onPublish: () => void;
}

export default function FloatingActionButton({
  hasDraft,
  onEdit,
  onDiscard,
  onPublish,
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFabClick = () => {
    if (hasDraft) {
      // Toggle menu
      setIsExpanded(!isExpanded);
    } else {
      // Direct edit
      onEdit();
    }
  };

  const handleEdit = () => {
    setIsExpanded(false);
    onEdit();
  };

  const handleDiscard = () => {
    setIsExpanded(false);
    onDiscard();
  };

  const handlePublish = () => {
    setIsExpanded(false);
    onPublish();
  };

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-24 right-4 z-40">
        {/* Expanded Menu */}
        {isExpanded && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end mb-2">
            {/* Publish button */}
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Check size={18} />
              <span>Publish</span>
            </button>

            {/* Edit button */}
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Edit size={18} />
              <span>Edit</span>
            </button>

            {/* Discard button */}
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <Trash2 size={18} />
              <span>Discard</span>
            </button>
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={handleFabClick}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isExpanded
              ? 'bg-gray-600 hover:bg-gray-700'
              : hasDraft
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isExpanded ? (
            <X size={24} className="text-white" />
          ) : hasDraft ? (
            <MoreVertical size={24} className="text-white" />
          ) : (
            <Edit size={24} className="text-white" />
          )}
        </button>
      </div>
    </>
  );
}
