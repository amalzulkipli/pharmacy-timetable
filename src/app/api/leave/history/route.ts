import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';

// GET /api/leave/history?staffId=xxx&year=2025
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const year = searchParams.get('year');

    const where: Record<string, unknown> = { status: 'approved' };

    if (staffId) {
      where.staffId = staffId;
    }

    if (year) {
      const yearNum = parseInt(year);
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lte: new Date(yearNum, 11, 31),
      };
    }

    const history = await prisma.leaveHistory.findMany({
      where,
      include: { staff: true },
      orderBy: { date: 'desc' },
    });

    const transformed = history.map((h) => ({
      id: h.id,
      staffId: h.staffId,
      staffName: h.staff.name,
      date: format(h.date, 'yyyy-MM-dd'),
      leaveType: h.leaveType,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching leave history:', error);
    return NextResponse.json({ error: 'Failed to fetch leave history' }, { status: 500 });
  }
}
