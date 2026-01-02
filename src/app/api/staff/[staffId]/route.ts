import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ staffId: string }>;
}

// Helper to parse defaultOffDays, handling double-stringify bug
const parseOffDays = (val: string): number[] => {
  let parsed = JSON.parse(val);
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }
  return parsed as number[];
};

// GET /api/staff/[staffId] - Get single staff member
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { staffId } = await params;

    const staff = await prisma.staff.findUnique({
      where: { staffId },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
      weeklyHours: staff.weeklyHours,
      defaultOffDays: parseOffDays(staff.defaultOffDays),
      alEntitlement: staff.alEntitlement,
      isActive: staff.isActive,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// PUT /api/staff/[staffId] - Update staff member
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { staffId } = await params;
    const body = await request.json();
    const { name, role, weeklyHours, defaultOffDays, alEntitlement, isActive } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (weeklyHours !== undefined) updateData.weeklyHours = weeklyHours;
    if (defaultOffDays !== undefined) updateData.defaultOffDays = JSON.stringify(defaultOffDays);
    if (alEntitlement !== undefined) updateData.alEntitlement = alEntitlement;
    if (isActive !== undefined) updateData.isActive = isActive;

    const staff = await prisma.staff.update({
      where: { staffId },
      data: updateData,
    });

    // If AL entitlement changed, update current year's leave balance
    if (alEntitlement !== undefined) {
      const currentYear = new Date().getFullYear();
      await prisma.leaveBalance.updateMany({
        where: { staffId, year: currentYear },
        data: { alEntitlement },
      });
    }

    return NextResponse.json({
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
      weeklyHours: staff.weeklyHours,
      defaultOffDays: parseOffDays(staff.defaultOffDays),
      alEntitlement: staff.alEntitlement,
      isActive: staff.isActive,
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}

// DELETE /api/staff/[staffId] - Soft delete (deactivate) staff member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { staffId } = await params;

    // Soft delete by setting isActive to false
    await prisma.staff.update({
      where: { staffId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Staff deactivated' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
