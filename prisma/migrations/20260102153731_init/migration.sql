-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL,
    "defaultOffDays" TEXT NOT NULL,
    "alEntitlement" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftType" TEXT,
    "isLeave" BOOLEAN NOT NULL DEFAULT false,
    "leaveType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleOverride_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("staffId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplacementShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "originalStaffId" TEXT NOT NULL,
    "tempStaffName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "workHours" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "alEntitlement" INTEGER NOT NULL DEFAULT 14,
    "alUsed" REAL NOT NULL DEFAULT 0,
    "rlEarned" REAL NOT NULL DEFAULT 0,
    "rlUsed" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveBalance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("staffId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "leaveType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("staffId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

-- CreateIndex
CREATE INDEX "Staff_staffId_idx" ON "Staff"("staffId");

-- CreateIndex
CREATE INDEX "ScheduleOverride_date_idx" ON "ScheduleOverride"("date");

-- CreateIndex
CREATE INDEX "ScheduleOverride_staffId_idx" ON "ScheduleOverride"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleOverride_date_staffId_key" ON "ScheduleOverride"("date", "staffId");

-- CreateIndex
CREATE INDEX "ReplacementShift_date_idx" ON "ReplacementShift"("date");

-- CreateIndex
CREATE INDEX "ReplacementShift_originalStaffId_idx" ON "ReplacementShift"("originalStaffId");

-- CreateIndex
CREATE INDEX "LeaveBalance_staffId_idx" ON "LeaveBalance"("staffId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_staffId_year_key" ON "LeaveBalance"("staffId", "year");

-- CreateIndex
CREATE INDEX "LeaveHistory_staffId_idx" ON "LeaveHistory"("staffId");

-- CreateIndex
CREATE INDEX "LeaveHistory_date_idx" ON "LeaveHistory"("date");

-- CreateIndex
CREATE INDEX "LeaveHistory_staffId_date_idx" ON "LeaveHistory"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_key" ON "PublicHoliday"("date");

-- CreateIndex
CREATE INDEX "PublicHoliday_year_idx" ON "PublicHoliday"("year");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");
