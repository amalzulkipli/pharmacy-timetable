'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShiftDefinition, ReplacementShift } from '@/types/schedule';

interface OverrideData {
  shift: ShiftDefinition | null;
  isLeave: boolean;
  leaveType?: 'AL' | 'RL' | 'EL';
}

type MonthOverrides = Record<string, OverrideData | ReplacementShift[]>;

interface UseScheduleDBOptions {
  year: number;
  month: number;
  fallbackToLocal?: boolean;
}

interface UseScheduleDBReturn {
  overrides: Record<string, MonthOverrides>;
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  saveOverrides: (newOverrides: Record<string, MonthOverrides>) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

export function useScheduleOverridesDB({
  year,
  month,
  fallbackToLocal = true,
}: UseScheduleDBOptions): UseScheduleDBReturn {
  const [overrides, setOverrides] = useState<Record<string, MonthOverrides>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const isMounted = useRef(true);

  // Get localStorage cache key
  const getCacheKey = useCallback(() => {
    return `pharmacy-cache-${year}-${month.toString().padStart(2, '0')}`;
  }, [year, month]);

  // Get pending changes key
  const getPendingKey = useCallback(() => {
    return `pharmacy-pending-${year}-${month.toString().padStart(2, '0')}`;
  }, [year, month]);

  // Fetch from database
  const fetchOverrides = useCallback(async () => {
    if (!isMounted.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/overrides?year=${year}&month=${month}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      if (isMounted.current) {
        setOverrides(data);
        setIsOnline(true);

        // Cache to localStorage for offline fallback
        if (fallbackToLocal && typeof window !== 'undefined') {
          localStorage.setItem(getCacheKey(), JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error('Error fetching overrides from DB:', err);

      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsOnline(false);

        // Fall back to localStorage cache
        if (fallbackToLocal && typeof window !== 'undefined') {
          const cached = localStorage.getItem(getCacheKey());
          if (cached) {
            try {
              setOverrides(JSON.parse(cached));
            } catch {
              console.error('Failed to parse cached data');
            }
          }

          // Also check for pending changes that weren't synced
          const pending = localStorage.getItem(getPendingKey());
          if (pending) {
            try {
              setOverrides(JSON.parse(pending));
            } catch {
              console.error('Failed to parse pending data');
            }
          }
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [year, month, fallbackToLocal, getCacheKey, getPendingKey]);

  // Save to database
  const saveOverrides = useCallback(
    async (newOverrides: Record<string, MonthOverrides>): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch('/api/overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month, overrides: newOverrides }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.details || errorData.error || response.statusText;
          throw new Error(`Failed to save: ${errorMessage}`);
        }

        setOverrides(newOverrides);
        setIsOnline(true);

        // Update cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(getCacheKey(), JSON.stringify(newOverrides));
          // Clear any pending changes since we successfully saved
          localStorage.removeItem(getPendingKey());
        }

        return { success: true };
      } catch (err) {
        console.error('Error saving overrides to DB:', err);
        setIsOnline(false);

        // Queue for later sync if offline
        if (typeof window !== 'undefined') {
          localStorage.setItem(getPendingKey(), JSON.stringify(newOverrides));
        }

        // Update local state anyway so UI reflects changes
        setOverrides(newOverrides);

        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [year, month, getCacheKey, getPendingKey]
  );

  // Sync pending changes when coming back online
  const syncPendingChanges = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const pending = localStorage.getItem(getPendingKey());
    if (pending) {
      try {
        const pendingData = JSON.parse(pending);
        const result = await saveOverrides(pendingData);
        if (result.success) {
          console.log('Successfully synced pending changes');
        }
      } catch (err) {
        console.error('Failed to sync pending changes:', err);
      }
    }
  }, [getPendingKey, saveOverrides]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [syncPendingChanges]);

  // Fetch on mount and when year/month changes
  useEffect(() => {
    isMounted.current = true;
    fetchOverrides();

    return () => {
      isMounted.current = false;
    };
  }, [fetchOverrides]);

  return {
    overrides,
    isLoading,
    error,
    isOnline,
    saveOverrides,
    refetch: fetchOverrides,
  };
}

// Hook to check if migration has been done
export function useMigrationStatus() {
  const [status, setStatus] = useState<{
    migrated: boolean;
    counts: { staff: number; holidays: number; overrides: number; balances: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch('/api/migrate');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Error checking migration status:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, []);

  return { status, isLoading };
}

// Hook to trigger migration
export function useMigration() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    results?: {
      staffSeeded: number;
      holidaysSeeded: number;
      overridesMigrated: number;
      balancesInitialized: number;
      errors: string[];
    };
  } | null>(null);

  const migrate = useCallback(async (localStorageData?: Record<string, unknown>, seedOnly = false) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localStorageData, seedOnly }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, ...data });
      } else {
        setResult({ success: false, message: data.error || 'Migration failed' });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Migration failed',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { migrate, isLoading, result };
}
