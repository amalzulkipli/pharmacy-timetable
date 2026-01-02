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
      status: h.status,
      notes: h.notes,
      createdAt: h.createdAt,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching leave history:', error);
    return NextResponse.json({ error: 'Failed to fetch leave history' }, { status: 500 });
  }
}

// DELETE /api/leave/history?id=xxx - Cancel a leave entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    // Get the leave history entry
    const entry = await prisma.leaveHistory.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Leave entry not found' }, { status: 404 });
    }

    const year = entry.date.getFullYear();

    // Update the entry status to cancelled
    await prisma.leaveHistory.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Refund the balance (only for AL and RL)
    if (entry.leaveType === 'AL' || entry.leaveType === 'RL') {
      const field = entry.leaveType === 'AL' ? 'alUsed' : 'rlUsed';
      await prisma.leaveBalance.updateMany({
        where: { staffId: entry.staffId, year },
        data: { [field]: { decrement: 1 } },
      });
    }

    // Also remove the schedule override for that day
    await prisma.scheduleOverride.deleteMany({
      where: {
        staffId: entry.staffId,
        date: entry.date,
        isLeave: true,
      },
    });

    return NextResponse.json({ success: true, message: 'Leave entry cancelled and balance refunded' });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    return NextResponse.json({ error: 'Failed to cancel leave' }, { status: 500 });
  }
}
