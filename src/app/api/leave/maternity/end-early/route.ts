import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { subDays, startOfDay } from 'date-fns';

// POST /api/leave/maternity/end-early - End maternity leave early
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, returnDate } = body;

    if (!staffId || !returnDate) {
      return NextResponse.json(
        { error: 'Missing required fields: staffId, returnDate' },
        { status: 400 }
      );
    }

    const returnDateObj = startOfDay(new Date(returnDate));

    // Step 1: Find active maternity period
    const activePeriod = await prisma.maternityLeavePeriod.findFirst({
      where: { staffId, status: 'active' },
    });

    if (!activePeriod) {
      return NextResponse.json(
        { error: 'No active maternity leave period found for this staff member' },
        { status: 404 }
      );
    }

    // Step 2: Validate returnDate
    const periodStart = startOfDay(activePeriod.startDate);
    const periodEnd = startOfDay(activePeriod.endDate);

    if (returnDateObj <= periodStart) {
      return NextResponse.json(
        { error: 'Return date must be after the maternity start date' },
        { status: 400 }
      );
    }

    if (returnDateObj > periodEnd) {
      return NextResponse.json(
        { error: 'Return date must be within the maternity period' },
        { status: 400 }
      );
    }

    // Execute all cleanup in one transaction
    const result = await prisma.$transaction(async (tx) => {
      // Step 3: Delete ScheduleOverride MAT entries from returnDate onward
      const deletedOverrides = await tx.scheduleOverride.deleteMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
        },
      });

      // Step 4: Delete ScheduleDraft MAT entries from returnDate onward
      const deletedDrafts = await tx.scheduleDraft.deleteMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
        },
      });

      // Step 5: Clean up orphaned DraftMonth records (only affected months)
      if (deletedDrafts.count > 0) {
        const affectedMonths = new Set<string>();
        let cursor = new Date(returnDateObj);
        while (cursor <= periodEnd) {
          affectedMonths.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }

        for (const monthKey of affectedMonths) {
          const [yearStr, monthStr] = monthKey.split('-');
          const y = parseInt(yearStr);
          const m = parseInt(monthStr);
          const startOfMonthDate = new Date(y, m - 1, 1);
          const endOfMonthDate = new Date(y, m, 0, 23, 59, 59);
          const remainingDrafts = await tx.scheduleDraft.count({
            where: {
              date: { gte: startOfMonthDate, lte: endOfMonthDate },
            },
          });
          if (remainingDrafts === 0) {
            await tx.draftMonth.deleteMany({
              where: { year: y, month: m },
            });
          }
        }
      }

      // Step 6: Count and delete LeaveHistory MAT entries from returnDate onward
      const historyToDelete = await tx.leaveHistory.findMany({
        where: {
          staffId,
          date: { gte: returnDateObj },
          leaveType: 'MAT',
          status: 'approved',
        },
        select: { id: true, date: true },
      });

      // Group by year for balance adjustment
      const countByYear = new Map<number, number>();
      for (const entry of historyToDelete) {
        const year = entry.date.getFullYear();
        countByYear.set(year, (countByYear.get(year) || 0) + 1);
      }

      // Delete the history entries
      if (historyToDelete.length > 0) {
        await tx.leaveHistory.deleteMany({
          where: {
            id: { in: historyToDelete.map(h => h.id) },
          },
        });
      }

      // Step 7: Decrement LeaveBalance.matUsed per year
      for (const [year, count] of countByYear) {
        await tx.leaveBalance.updateMany({
          where: { staffId, year },
          data: { matUsed: { decrement: count } },
        });
      }

      // Step 8: Update MaternityLeavePeriod
      const newEndDate = startOfDay(subDays(returnDateObj, 1));
      await tx.maternityLeavePeriod.update({
        where: { id: activePeriod.id },
        data: {
          endDate: newEndDate,
          status: 'ended_early',
        },
      });

      return {
        daysRemoved: deletedOverrides.count + deletedDrafts.count,
        newEndDate: newEndDate.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      daysRemoved: result.daysRemoved,
      newEndDate: result.newEndDate,
    });
  } catch (error) {
    console.error('Error ending maternity leave early:', error);
    return NextResponse.json(
      { error: 'Failed to end maternity leave early' },
      { status: 500 }
    );
  }
}
