import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

// POST /api/overrides/discard - Discard draft, revert to published state
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
      // Delete all drafts for this month
      await tx.scheduleDraft.deleteMany({
        where: { date: { gte: startDate, lte: endDate } },
      });

      // Delete the DraftMonth record
      await tx.draftMonth.delete({
        where: { year_month: { year, month } },
      });
    });

    return NextResponse.json({ success: true, discarded: true });
  } catch (error) {
    console.error('Error discarding draft:', error);
    return NextResponse.json(
      { error: 'Failed to discard draft' },
      { status: 500 }
    );
  }
}
