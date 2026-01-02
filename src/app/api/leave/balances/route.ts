import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export interface LeaveBalanceSummary {
  staffId: string;
  staffName: string;
  staffRole: string;
  year: number;
  al: {
    entitlement: number;
    used: number;
    remaining: number;
  };
  rl: {
    earned: number;
    used: number;
    remaining: number;
  };
}

// GET /api/leave/balances?year=2025
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const balances = await prisma.leaveBalance.findMany({
      where: {
        year,
        staff: { isActive: true },
      },
      include: { staff: true },
    });

    const summaries: LeaveBalanceSummary[] = balances.map((b) => ({
      staffId: b.staffId,
      staffName: b.staff.name,
      staffRole: b.staff.role,
      year: b.year,
      al: {
        entitlement: b.alEntitlement,
        used: b.alUsed,
        remaining: b.alEntitlement - b.alUsed,
      },
      rl: {
        earned: b.rlEarned,
        used: b.rlUsed,
        remaining: b.rlEarned - b.rlUsed,
      },
    }));

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    return NextResponse.json({ error: 'Failed to fetch leave balances' }, { status: 500 });
  }
}

// POST /api/leave/balances - Initialize balances for a year
export async function POST(request: NextRequest) {
  try {
    const { year } = await request.json();

    if (!year) {
      return NextResponse.json({ error: 'Missing required field: year' }, { status: 400 });
    }

    // Get all active staff
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
    });

    // Create or update balances for each staff member
    for (const member of staff) {
      await prisma.leaveBalance.upsert({
        where: { staffId_year: { staffId: member.staffId, year } },
        create: {
          staffId: member.staffId,
          year,
          alEntitlement: member.alEntitlement,
          alUsed: 0,
          rlEarned: 0,
          rlUsed: 0,
        },
        update: {
          alEntitlement: member.alEntitlement,
        },
      });
    }

    return NextResponse.json({ success: true, message: `Initialized balances for ${staff.length} staff members` });
  } catch (error) {
    console.error('Error initializing leave balances:', error);
    return NextResponse.json({ error: 'Failed to initialize leave balances' }, { status: 500 });
  }
}
