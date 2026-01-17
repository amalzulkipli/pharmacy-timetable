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

// GET /api/overrides?year=2025&month=1&view=published|admin
// view=published (default): Returns only published ScheduleOverride data
// view=admin: Returns ScheduleDraft if exists, otherwise ScheduleOverride
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const view = searchParams.get('view') || 'published'; // 'published' | 'admin'

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // Check if draft exists for this month
    const draftMonth = await prisma.draftMonth.findUnique({
      where: { year_month: { year, month } },
    });
    const hasDraft = !!draftMonth;

    // Determine which table to fetch from
    const useDraft = view === 'admin' && hasDraft;

    const [scheduleData, replacementShifts] = await Promise.all([
      useDraft
        ? prisma.scheduleDraft.findMany({
            where: { date: { gte: startDate, lte: endDate } },
          })
        : prisma.scheduleOverride.findMany({
            where: { date: { gte: startDate, lte: endDate } },
          }),
      prisma.replacementShift.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      }),
    ]);

    // Transform to match current localStorage structure
    const overridesByDate: Record<string, Record<string, unknown>> = {};

    scheduleData.forEach((override) => {
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

    // Return data with metadata
    return NextResponse.json({
      data: overridesByDate,
      meta: {
        hasDraft,
        year,
        month,
      },
    });
  } catch (error) {
    console.error('Error fetching overrides:', error);
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
  }
}

// POST /api/overrides - Save overrides as DRAFT (not published)
// Leave balances are NOT updated here - only on publish
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
      // Delete existing drafts for this month, but PRESERVE maternity leave entries
      await tx.scheduleDraft.deleteMany({
        where: {
          date: { gte: startDate, lte: endDate },
          NOT: { leaveType: 'MAT' } // Don't delete maternity leave entries
        },
      });

      // Insert new draft overrides
      for (const [dateKey, dayOverrides] of Object.entries(overrides)) {
        const date = parseISO(dateKey);

        for (const [key, value] of Object.entries(dayOverrides as Record<string, unknown>)) {
          // Skip replacements for now (they go directly to ReplacementShift)
          if (key === 'replacements') {
            continue;
          }

          // Handle staff schedule draft
          const override = value as {
            shift?: { startTime: string; endTime: string; workHours: number };
            isLeave: boolean;
            leaveType?: string;
          };

          let shiftType: string | null = null;
          if (override.shift) {
            shiftType = findShiftKey(override.shift);
          }

          // Check if there's an existing MAT entry - don't overwrite it unless explicitly setting MAT
          const existingEntry = await tx.scheduleDraft.findUnique({
            where: { date_staffId: { date, staffId: key } },
            select: { leaveType: true },
          });

          // Skip if existing entry is MAT and incoming is not MAT
          if (existingEntry?.leaveType === 'MAT' && override.leaveType !== 'MAT') {
            continue; // Preserve the MAT entry
          }

          await tx.scheduleDraft.upsert({
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
        }
      }

      // Mark this month as having a draft
      await tx.draftMonth.upsert({
        where: { year_month: { year, month } },
        update: { updatedAt: new Date() },
        create: { year, month },
      });
    });

    return NextResponse.json({ success: true, isDraft: true });
  } catch (error) {
    console.error('Error saving draft:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to save draft', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
