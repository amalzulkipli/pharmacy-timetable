import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDay } from 'date-fns';

// POST /api/leave/calculate-rl - Calculate RL credits for all staff
// RL is earned when a public holiday falls on a staff's default off day
export async function POST(request: NextRequest) {
  try {
    const { year } = await request.json();

    if (!year) {
      return NextResponse.json({ error: 'Missing required field: year' }, { status: 400 });
    }

    // Get all active staff with their default off days
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
    });

    // Get all public holidays for the year
    const holidays = await prisma.publicHoliday.findMany({
      where: { year },
    });

    // Calculate RL for each staff member
    const rlCredits: Record<string, { earned: number; holidays: string[] }> = {};

    for (const member of staff) {
      const defaultOffDays = JSON.parse(member.defaultOffDays) as number[];
      let rlEarned = 0;
      const matchingHolidays: string[] = [];

      for (const holiday of holidays) {
        const holidayDayOfWeek = getDay(holiday.date); // 0=Sunday, 6=Saturday

        // If holiday falls on staff's default off day, they earn 1 RL
        if (defaultOffDays.includes(holidayDayOfWeek)) {
          rlEarned += 1;
          matchingHolidays.push(holiday.name);
        }
      }

      rlCredits[member.staffId] = { earned: rlEarned, holidays: matchingHolidays };

      // Upsert leave balance
      await prisma.leaveBalance.upsert({
        where: {
          staffId_year: { staffId: member.staffId, year },
        },
        create: {
          staffId: member.staffId,
          year,
          alEntitlement: member.alEntitlement,
          rlEarned,
        },
        update: {
          rlEarned,
          alEntitlement: member.alEntitlement,
        },
      });
    }

    return NextResponse.json({
      success: true,
      year,
      totalHolidays: holidays.length,
      rlCredits,
    });
  } catch (error) {
    console.error('Error calculating RL:', error);
    return NextResponse.json({ error: 'Failed to calculate RL' }, { status: 500 });
  }
}
