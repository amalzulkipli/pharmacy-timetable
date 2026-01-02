import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseISO, getDay } from 'date-fns';
import { STAFF_MEMBERS, SHIFT_DEFINITIONS } from '@/staff-data';
import { PUBLIC_HOLIDAYS } from '@/lib/schedule-generator';

// Helper to find shift key from shift definition
function findShiftKey(shift: { startTime: string; endTime: string; workHours: number }): string | null {
  for (const [key, def] of Object.entries(SHIFT_DEFINITIONS)) {
    if (def.startTime === shift.startTime && def.endTime === shift.endTime && def.workHours === shift.workHours) {
      return key;
    }
  }
  return null;
}

// POST /api/migrate - Migrate localStorage data to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { localStorageData, seedOnly } = body;

    const results = {
      staffSeeded: 0,
      holidaysSeeded: 0,
      overridesMigrated: 0,
      balancesInitialized: 0,
      errors: [] as string[],
    };

    // 1. Seed staff members from current hardcoded data
    for (const staff of STAFF_MEMBERS) {
      try {
        await prisma.staff.upsert({
          where: { staffId: staff.id },
          create: {
            staffId: staff.id,
            name: staff.name,
            role: staff.role,
            weeklyHours: staff.weeklyHours,
            defaultOffDays: JSON.stringify(staff.defaultOffDays),
            alEntitlement: 14, // Default
          },
          update: {
            name: staff.name,
            role: staff.role,
            weeklyHours: staff.weeklyHours,
            defaultOffDays: JSON.stringify(staff.defaultOffDays),
          },
        });
        results.staffSeeded++;
      } catch (error) {
        results.errors.push(`Failed to seed staff ${staff.id}: ${error}`);
      }
    }

    // 2. Seed public holidays
    for (const holiday of PUBLIC_HOLIDAYS) {
      try {
        const date = parseISO(holiday.date);
        await prisma.publicHoliday.upsert({
          where: { date },
          create: {
            date,
            name: holiday.name,
            year: date.getFullYear(),
          },
          update: { name: holiday.name },
        });
        results.holidaysSeeded++;
      } catch (error) {
        results.errors.push(`Failed to seed holiday ${holiday.date}: ${error}`);
      }
    }

    // 3. Migrate localStorage overrides if provided
    if (localStorageData && typeof localStorageData === 'object' && !seedOnly) {
      for (const monthOverrides of Object.values(localStorageData)) {
        // Iterate through each month's overrides

        for (const [dateKey, dayOverrides] of Object.entries(monthOverrides as Record<string, unknown>)) {
          try {
            const date = parseISO(dateKey);

            for (const [key, value] of Object.entries(dayOverrides as Record<string, unknown>)) {
              if (key === 'replacements') {
                // Handle replacement shifts
                const replacements = value as Array<{
                  originalStaffId: string;
                  tempStaffName: string;
                  startTime: string;
                  endTime: string;
                  workHours: number;
                }>;

                for (const rep of replacements) {
                  await prisma.replacementShift.create({
                    data: {
                      date,
                      originalStaffId: rep.originalStaffId,
                      tempStaffName: rep.tempStaffName,
                      startTime: rep.startTime,
                      endTime: rep.endTime,
                      workHours: rep.workHours,
                    },
                  });
                  results.overridesMigrated++;
                }
              } else {
                // Staff override
                const override = value as {
                  shift?: { startTime: string; endTime: string; workHours: number; type?: string; timing?: string };
                  isLeave: boolean;
                  leaveType?: string;
                };

                let shiftType: string | null = null;
                if (override.shift) {
                  shiftType = findShiftKey(override.shift);
                }

                await prisma.scheduleOverride.upsert({
                  where: { date_staffId: { date, staffId: key } },
                  create: {
                    date,
                    staffId: key,
                    shiftType,
                    isLeave: override.isLeave || false,
                    leaveType: override.leaveType || null,
                  },
                  update: {
                    shiftType,
                    isLeave: override.isLeave || false,
                    leaveType: override.leaveType || null,
                  },
                });
                results.overridesMigrated++;
              }
            }
          } catch (error) {
            results.errors.push(`Failed to migrate override for ${dateKey}: ${error}`);
          }
        }
      }
    }

    // 4. Initialize leave balances for current and next year
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];

    for (const year of years) {
      const staff = await prisma.staff.findMany({ where: { isActive: true } });
      const holidays = await prisma.publicHoliday.findMany({ where: { year } });

      for (const member of staff) {
        try {
          const defaultOffDays = JSON.parse(member.defaultOffDays) as number[];
          let rlEarned = 0;

          // Calculate RL credits
          for (const holiday of holidays) {
            const dayOfWeek = getDay(holiday.date);
            if (defaultOffDays.includes(dayOfWeek)) {
              rlEarned += 1;
            }
          }

          await prisma.leaveBalance.upsert({
            where: { staffId_year: { staffId: member.staffId, year } },
            create: {
              staffId: member.staffId,
              year,
              alEntitlement: member.alEntitlement,
              rlEarned,
            },
            update: { rlEarned },
          });
          results.balancesInitialized++;
        } catch (error) {
          results.errors.push(`Failed to initialize balance for ${member.staffId} in ${year}: ${error}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}

// GET /api/migrate - Check migration status
export async function GET() {
  try {
    const [staffCount, holidayCount, overrideCount, balanceCount] = await Promise.all([
      prisma.staff.count(),
      prisma.publicHoliday.count(),
      prisma.scheduleOverride.count(),
      prisma.leaveBalance.count(),
    ]);

    return NextResponse.json({
      migrated: staffCount > 0,
      counts: {
        staff: staffCount,
        holidays: holidayCount,
        overrides: overrideCount,
        balances: balanceCount,
      },
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json({ error: 'Failed to check migration status' }, { status: 500 });
  }
}
