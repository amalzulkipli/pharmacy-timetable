'use client';

import { useState, useEffect, useMemo } from 'react';
import { STAFF_MEMBERS } from '@/staff-data';
import { apiUrl } from '@/lib/api';
import type { StaffMember } from '@/types/schedule';

// Extended StaffMember type with database fields
export interface DatabaseStaffMember extends StaffMember {
  startDate?: Date | null;
  colorIndex?: number | null;
  alEntitlement?: number;
  mlEntitlement?: number;
  isActive?: boolean;
}

// Legacy staff IDs that exist in STAFF_MEMBERS constant
const LEGACY_STAFF_IDS = new Set(STAFF_MEMBERS.map(s => s.id));

/**
 * Hook to fetch and manage staff members from the database
 * Merges database staff with legacy hardcoded staff
 */
export function useStaffMembers() {
  const [dbStaff, setDbStaff] = useState<DatabaseStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(apiUrl('/api/staff'));

        // If unauthorized (public view), use fallback STAFF_MEMBERS
        if (response.status === 401) {
          setDbStaff([]);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch staff');
        }
        const data = await response.json();

        // Transform API response to DatabaseStaffMember format
        const transformed: DatabaseStaffMember[] = data.map((s: {
          id: string;
          name: string;
          role: string;
          weeklyHours: number;
          defaultOffDays: number[];
          startDate?: string | null;
          colorIndex?: number | null;
          alEntitlement?: number;
          mlEntitlement?: number;
          isActive?: boolean;
        }) => ({
          id: s.id,
          name: s.name,
          role: s.role as 'Pharmacist' | 'Assistant Pharmacist',
          weeklyHours: s.weeklyHours,
          defaultOffDays: s.defaultOffDays,
          startDate: s.startDate ? new Date(s.startDate) : null,
          colorIndex: s.colorIndex,
          alEntitlement: s.alEntitlement,
          mlEntitlement: s.mlEntitlement,
          isActive: s.isActive,
        }));

        setDbStaff(transformed);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError(err instanceof Error ? err.message : 'Failed to load staff');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaff();
  }, []);

  // Merge database staff with legacy staff
  // Legacy staff (fatimah, siti, pah, amal) take precedence from hardcoded STAFF_MEMBERS
  // New staff (like Rina) come from the database
  const staff = useMemo<DatabaseStaffMember[]>(() => {
    // Start with legacy staff members (guaranteed to always exist)
    const result: DatabaseStaffMember[] = STAFF_MEMBERS.map(legacyStaff => {
      // Find any database record for this legacy staff (to get startDate/colorIndex if set)
      const dbRecord = dbStaff.find(s => s.id === legacyStaff.id);
      return {
        ...legacyStaff,
        startDate: dbRecord?.startDate || null,
        colorIndex: dbRecord?.colorIndex ?? null,
        alEntitlement: dbRecord?.alEntitlement,
        mlEntitlement: dbRecord?.mlEntitlement,
        isActive: dbRecord?.isActive ?? true,
      };
    });

    // Add any database staff that are NOT in the legacy list (new staff)
    dbStaff
      .filter(s => !LEGACY_STAFF_IDS.has(s.id) && s.isActive !== false)
      .forEach(newStaff => {
        result.push(newStaff);
      });

    return result;
  }, [dbStaff]);

  return { staff, isLoading, error };
}

/**
 * Filter staff members who are active on a given date
 * Staff with no startDate are considered always active (legacy staff)
 * Staff with startDate only appear from that date forward
 */
export function getActiveStaffForDate(
  staffList: DatabaseStaffMember[],
  date: Date
): DatabaseStaffMember[] {
  return staffList.filter(staff => {
    // If no startDate, staff is always active (legacy staff)
    if (!staff.startDate) return true;

    // Staff is active if the date is on or after their start date
    const staffStart = new Date(staff.startDate);
    // Compare dates only (ignore time)
    staffStart.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate >= staffStart;
  });
}
