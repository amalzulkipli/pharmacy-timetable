import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

// POST /api/overrides/publish - Publish draft to live
// This copies ScheduleDraft to ScheduleOverride and updates leave balances
export async function POST(request: NextRequest) {
  try {
    const { year, month } = await request.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Missing required fields: year, month' }, { status: 400 });
    }

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // Check if draft exists
    const draftMonth = await prisma.draftMonth.findUnique({
      where: { year_month: { year, month } },
    });

    if (!draftMonth) {
      return NextResponse.json({ error: 'No draft found for this month' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Fetch all drafts for this month
      const drafts = await tx.scheduleDraft.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      });

      // Delete existing published overrides for this month
      await tx.scheduleOverride.deleteMany({
        where: { date: { gte: startDate, lte: endDate } },
      });

      // Track leave changes for balance updates
      const leaveChanges: { staffId: string; leaveType: string; date: Date }[] = [];

      // Copy drafts to published overrides
      for (const draft of drafts) {
        await tx.scheduleOverride.create({
          data: {
            date: draft.date,
            staffId: draft.staffId,
            shiftType: draft.shiftType,
            isLeave: draft.isLeave,
            leaveType: draft.leaveType,
          },
        });

        // Track leave for balance updates
        if (draft.isLeave && draft.leaveType) {
          leaveChanges.push({
            staffId: draft.staffId,
            leaveType: draft.leaveType,
            date: draft.date,
          });
        }
      }

      // Update leave balances and history
      for (const change of leaveChanges) {
        if (change.leaveType === 'AL' || change.leaveType === 'RL' || change.leaveType === 'ML' || change.leaveType === 'MAT') {
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
              MAT: 'matUsed',
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

      // Delete all drafts for this month
      await tx.scheduleDraft.deleteMany({
        where: { date: { gte: startDate, lte: endDate } },
      });

      // Delete the DraftMonth record
      await tx.draftMonth.delete({
        where: { year_month: { year, month } },
      });
    });

    return NextResponse.json({ success: true, published: true });
  } catch (error) {
    console.error('Error publishing draft:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to publish draft', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
