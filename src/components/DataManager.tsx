'use client';

import React, { useState, useRef } from 'react';
import { useScheduleOverrides } from '../hooks/useLocalStorage';
import { Download, Upload, FileText, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

interface DataManagerProps {
  isAdmin: boolean;
}

export default function DataManager({ isAdmin }: DataManagerProps) {
  const { exportAllOverrides, importOverrides, clearAllOverrides } = useScheduleOverrides();
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return null; // Only show for admin users
  }

  const handleExport = () => {
    exportAllOverrides();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = importOverrides(content);
      
      setImportMessage({
        type: result.success ? 'success' : 'error',
        text: result.message
      });

      // Clear message after 5 seconds
      setTimeout(() => setImportMessage(null), 5000);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearAll = () => {
    clearAllOverrides();
    setShowClearConfirm(false);
    setImportMessage({
      type: 'success',
      text: 'All schedule overrides have been cleared'
    });
    setTimeout(() => setImportMessage(null), 5000);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Schedule Data Management</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Overrides
        </button>

        {/* Import Button */}
        <button
          onClick={handleImportClick}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Overrides
        </button>

        {/* Clear All Button */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center justify-center px-4 py-3 border border-red-300 rounded-md shadow-sm bg-white text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Data
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Import Message */}
      {importMessage && (
        <div className={`mt-4 p-3 rounded-md flex items-center ${
          importMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {importMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          )}
          <span className={`text-sm ${
            importMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {importMessage.text}
          </span>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600">
          <strong>Export:</strong> Download all your schedule modifications as a JSON file to share with colleagues.
          <br />
          <strong>Import:</strong> Load schedule modifications from a JSON file shared by others.
          <br />
          <strong>Clear:</strong> Remove all local modifications and reset to default schedules.
        </p>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                Clear All Schedule Data
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to clear all schedule overrides? This action cannot be undone.
                  All manual schedule changes will be lost.
                </p>
              </div>
              <div className="flex items-center justify-center mt-4 space-x-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}