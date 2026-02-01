import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayOfInterval, addDays, startOfDay } from 'date-fns';

// POST /api/leave/maternity - Create 98 days of maternity leave
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { staffId, startDate } = body;

    if (!staffId || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: staffId, startDate' },
        { status: 400 }
      );
    }

    const start = startOfDay(new Date(startDate));
    const end = addDays(start, 97); // 98 days total (start + 97)

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { staffId },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    // Check for overlapping maternity leave period
    const existingPeriod = await prisma.maternityLeavePeriod.findFirst({
      where: {
        staffId,
        status: 'active',
        OR: [
          // New period starts during existing period
          { AND: [{ startDate: { lte: start } }, { endDate: { gte: start } }] },
          // New period ends during existing period
          { AND: [{ startDate: { lte: end } }, { endDate: { gte: end } }] },
          // Existing period is within new period
          { AND: [{ startDate: { gte: start } }, { endDate: { lte: end } }] },
        ],
      },
    });

    if (existingPeriod) {
      return NextResponse.json(
        { error: 'An active maternity leave period already exists for this staff member in the selected date range' },
        { status: 400 }
      );
    }

    // Get all days in the maternity leave period
    const days = eachDayOfInterval({ start, end });

    // Track affected months for DraftMonth records
    const affectedMonths = new Set<string>();
    days.forEach((day) => {
      const year = day.getFullYear();
      const month = day.getMonth() + 1; // 1-12
      affectedMonths.add(`${year}-${month}`);
    });

    // Create all records in a transaction
    await prisma.$transaction(async (tx) => {
      // Create the MaternityLeavePeriod record
      await tx.maternityLeavePeriod.create({
        data: {
          staffId,
          startDate: start,
          endDate: end,
          status: 'active',
        },
      });

      // Create ScheduleDraft entries for each day
      for (const day of days) {
        await tx.scheduleDraft.upsert({
          where: {
            date_staffId: {
              date: day,
              staffId,
            },
          },
          create: {
            date: day,
            staffId,
            shiftType: null,
            isLeave: true,
            leaveType: 'MAT',
          },
          update: {
            shiftType: null,
            isLeave: true,
            leaveType: 'MAT',
          },
        });
      }

      // Create/update DraftMonth records for each affected month
      for (const monthKey of affectedMonths) {
        const [yearStr, monthStr] = monthKey.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        await tx.draftMonth.upsert({
          where: { year_month: { year, month } },
          create: { year, month },
          update: { updatedAt: new Date() },
        });
      }
    });

    return NextResponse.json({
      success: true,
      daysCreated: days.length,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      affectedMonths: Array.from(affectedMonths),
    });
  } catch (error) {
    console.error('Error creating maternity leave:', error);
    return NextResponse.json(
      { error: 'Failed to create maternity leave' },
      { status: 500 }
    );
  }
}

// GET /api/leave/maternity - Get active maternity leave periods
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    const where = staffId
      ? { staffId, status: 'active' }
      : { status: 'active' };

    const periods = await prisma.maternityLeavePeriod.findMany({
      where,
      include: { staff: true },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json(periods);
  } catch (error) {
    console.error('Error fetching maternity leave periods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maternity leave periods' },
      { status: 500 }
    );
  }
}
