'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for persistent localStorage management with type safety
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Initialize value from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        setStoredValue(initialValue);
      }
    }
  }, [key, initialValue]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Function to clear the localStorage key
  const clearValue = () => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, clearValue] as const;
}

// Stable initial value to prevent unnecessary re-renders
const EMPTY_OVERRIDES: Record<string, Record<string, unknown>> = {};

/**
 * Hook specifically for managing manual schedule overrides
 */
export function useScheduleOverrides() {
  const [overrides, setOverrides, clearOverrides] = useLocalStorage<Record<string, Record<string, unknown>>>('pharmacy-overrides', EMPTY_OVERRIDES);

  const saveOverridesForMonth = useCallback((year: number, month: number, monthOverrides: Record<string, Record<string, unknown>>) => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    setOverrides(prev => ({
      ...prev,
      [monthKey]: monthOverrides
    }));
  }, [setOverrides]);

  const getOverridesForMonth = useCallback((year: number, month: number): Record<string, Record<string, unknown>> => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return (overrides[monthKey] as Record<string, Record<string, unknown>>) || {};
  }, [overrides]);

  const exportAllOverrides = useCallback(() => {
    const dataStr = JSON.stringify(overrides, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmacy-overrides-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [overrides]);

  const importOverrides = useCallback((jsonData: string) => {
    try {
      const importedData = JSON.parse(jsonData);
      if (typeof importedData === 'object' && importedData !== null) {
        setOverrides(importedData);
        return { success: true, message: 'Overrides imported successfully' };
      } else {
        return { success: false, message: 'Invalid JSON format' };
      }
    } catch {
      return { success: false, message: 'Error parsing JSON file' };
    }
  }, [setOverrides]);

  const clearOverrideForStaff = useCallback((year: number, month: number, dateKey: string, staffId: string) => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    setOverrides(prev => {
      const updated = { ...prev };
      if (updated[monthKey] && updated[monthKey][dateKey]) {
        const dayOverrides = { ...updated[monthKey][dateKey] } as Record<string, unknown>;
        delete dayOverrides[staffId];
        
        if (Object.keys(dayOverrides).length === 0) {
          // Remove the entire day if no overrides remain
          const monthOverrides = { ...updated[monthKey] } as Record<string, Record<string, unknown>>;
          delete monthOverrides[dateKey];
          updated[monthKey] = monthOverrides;
        } else {
          updated[monthKey] = {
            ...updated[monthKey],
            [dateKey]: dayOverrides
          };
        }
      }
      return updated;
    });
  }, [setOverrides]);

  const clearOverrideForDate = useCallback((year: number, month: number, dateKey: string) => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    setOverrides(prev => {
      const updated = { ...prev };
      if (updated[monthKey]) {
        const monthOverrides = { ...updated[monthKey] } as Record<string, Record<string, unknown>>;
        delete monthOverrides[dateKey];
        updated[monthKey] = monthOverrides;
      }
      return updated;
    });
  }, [setOverrides]);

  const clearOverrideForMonth = useCallback((year: number, month: number) => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    setOverrides(prev => {
      const updated = { ...prev };
      delete updated[monthKey];
      return updated;
    });
  }, [setOverrides]);

  return {
    overrides,
    saveOverridesForMonth,
    getOverridesForMonth,
    clearOverrideForStaff,
    clearOverrideForDate,
    clearOverrideForMonth,
    exportAllOverrides,
    importOverrides,
    clearAllOverrides: clearOverrides
  };
}