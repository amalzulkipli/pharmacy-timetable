import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper to parse defaultOffDays, handling double-stringify bug
const parseOffDays = (val: string): number[] => {
  let parsed = JSON.parse(val);
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }
  return parsed as number[];
};

// GET /api/staff - Get all staff members
export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const transformed = staff.map((s) => ({
      id: s.staffId,
      name: s.name,
      role: s.role,
      weeklyHours: s.weeklyHours,
      defaultOffDays: parseOffDays(s.defaultOffDays),
      alEntitlement: s.alEntitlement,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST /api/staff - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, name, role, weeklyHours, defaultOffDays, alEntitlement } = body;

    // Validate required fields
    if (!staffId || !name || !role || weeklyHours === undefined || !defaultOffDays) {
      return NextResponse.json(
        { error: 'Missing required fields: staffId, name, role, weeklyHours, defaultOffDays' },
        { status: 400 }
      );
    }

    // Check if staffId already exists
    const existing = await prisma.staff.findUnique({
      where: { staffId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Staff ID already exists' }, { status: 409 });
    }

    const staff = await prisma.staff.create({
      data: {
        staffId: staffId.toLowerCase().replace(/\s/g, ''),
        name,
        role,
        weeklyHours,
        defaultOffDays: JSON.stringify(defaultOffDays),
        alEntitlement: alEntitlement || 14,
      },
    });

    // Initialize leave balance for current year
    const currentYear = new Date().getFullYear();
    await prisma.leaveBalance.create({
      data: {
        staffId: staff.staffId,
        year: currentYear,
        alEntitlement: staff.alEntitlement,
        alUsed: 0,
        rlEarned: 0,
        rlUsed: 0,
      },
    });

    return NextResponse.json(
      {
        id: staff.staffId,
        name: staff.name,
        role: staff.role,
        weeklyHours: staff.weeklyHours,
        defaultOffDays: parseOffDays(staff.defaultOffDays),
        alEntitlement: staff.alEntitlement,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}
