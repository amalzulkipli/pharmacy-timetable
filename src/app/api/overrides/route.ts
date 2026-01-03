import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, format } from 'date-fns';
import { SHIFT_DEFINITIONS } from '@/staff-data';

// Helper to find shift key from shift definition
function findShiftKey(shift: { startTime: string; endTime: string; workHours: number }): string | null {
  for (const [key, def] of Object.entries(SHIFT_DEFINITIONS)) {
    if (def.startTime === shift.startTime && def.endTime === shift.endTime && def.workHours === shift.workHours) {
      return key;
    }
  }
  return null;
}

// GET /api/overrides?year=2025&month=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const [scheduleOverrides, replacementShifts] = await Promise.all([
      prisma.scheduleOverride.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
      }),
      prisma.replacementShift.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Transform to match current localStorage structure
    const overridesByDate: Record<string, Record<string, unknown>> = {};

    scheduleOverrides.forEach((override) => {
      const dateKey = format(override.date, 'yyyy-MM-dd');
      if (!overridesByDate[dateKey]) overridesByDate[dateKey] = {};

      overridesByDate[dateKey][override.staffId] = {
        shift: override.shiftType ? SHIFT_DEFINITIONS[override.shiftType] : null,
        isLeave: override.isLeave,
        leaveType: override.leaveType,
      };
    });

    replacementShifts.forEach((rep) => {
      const dateKey = format(rep.date, 'yyyy-MM-dd');
      if (!overridesByDate[dateKey]) overridesByDate[dateKey] = {};
      if (!overridesByDate[dateKey].replacements) overridesByDate[dateKey].replacements = [];

      (overridesByDate[dateKey].replacements as unknown[]).push({
        id: rep.id,
        originalStaffId: rep.originalStaffId,
        tempStaffName: rep.tempStaffName,
        startTime: rep.startTime,
        endTime: rep.endTime,
        workHours: rep.workHours,
      });
    });

    return NextResponse.json(overridesByDate);
  } catch (error) {
    console.error('Error fetching overrides:', error);
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
  }
}

// POST /api/overrides - Bulk save overrides for a month
export async function POST(request: NextRequest) {
  try {
    const { year, month, overrides } = await request.json();

    if (!year || !month || !overrides) {
      return NextResponse.json({ error: 'Missing required fields: year, month, overrides' }, { status: 400 });
    }

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // Use transaction for atomic updates
    await prisma.$transaction(async (tx) => {
      // Delete existing overrides for this month
      await tx.scheduleOverride.deleteMany({
        where: { date: { gte: startDate, lte: endDate } },
      });
      await tx.replacementShift.deleteMany({
        where: { date: { gte: startDate, lte: endDate } },
      });

      // Track leave changes for balance updates
      const leaveChanges: { staffId: string; leaveType: string; date: Date; action: 'add' | 'remove' }[] = [];

      // Insert new overrides
      for (const [dateKey, dayOverrides] of Object.entries(overrides)) {
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
              await tx.replacementShift.create({
                data: {
                  date,
                  originalStaffId: rep.originalStaffId,
                  tempStaffName: rep.tempStaffName,
                  startTime: rep.startTime,
                  endTime: rep.endTime,
                  workHours: rep.workHours,
                },
              });
            }
          } else {
            // Handle staff schedule override
            const override = value as {
              shift?: { startTime: string; endTime: string; workHours: number };
              isLeave: boolean;
              leaveType?: string;
            };

            let shiftType: string | null = null;
            if (override.shift) {
              shiftType = findShiftKey(override.shift);
            }

            await tx.scheduleOverride.upsert({
              where: {
                date_staffId: { date, staffId: key },
              },
              update: {
                shiftType,
                isLeave: override.isLeave || false,
                leaveType: override.leaveType || null,
              },
              create: {
                date,
                staffId: key,
                shiftType,
                isLeave: override.isLeave || false,
                leaveType: override.leaveType || null,
              },
            });

            // Track leave for balance updates
            if (override.isLeave && override.leaveType) {
              leaveChanges.push({
                staffId: key,
                leaveType: override.leaveType,
                date,
                action: 'add',
              });
            }
          }
        }
      }

      // Update leave balances and history
      for (const change of leaveChanges) {
        if (change.leaveType === 'AL' || change.leaveType === 'RL' || change.leaveType === 'ML') {
          // Check if leave history already exists for this date/staff
          const existingHistory = await tx.leaveHistory.findFirst({
            where: {
              staffId: change.staffId,
              date: change.date,
              status: 'approved',
            },
          });

          if (!existingHistory) {
            // Create leave history entry
            await tx.leaveHistory.create({
              data: {
                staffId: change.staffId,
                date: change.date,
                leaveType: change.leaveType,
                status: 'approved',
              },
            });

            // Update balance - use the leave date's year, not the calendar view year
            const leaveYear = change.date.getFullYear();
            const fieldMap: Record<string, string> = {
              AL: 'alUsed',
              RL: 'rlUsed',
              ML: 'mlUsed',
            };
            const field = fieldMap[change.leaveType];
            await tx.leaveBalance.updateMany({
              where: { staffId: change.staffId, year: leaveYear },
              data: { [field]: { increment: 1 } },
            });
          }
        } else if (change.leaveType === 'EL') {
          // EL doesn't have balance tracking, just record history
          const existingHistory = await tx.leaveHistory.findFirst({
            where: {
              staffId: change.staffId,
              date: change.date,
              status: 'approved',
            },
          });

          if (!existingHistory) {
            await tx.leaveHistory.create({
              data: {
                staffId: change.staffId,
                date: change.date,
                leaveType: 'EL',
                status: 'approved',
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving overrides:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to save overrides', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
