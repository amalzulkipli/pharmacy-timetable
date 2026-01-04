-- CreateTable
CREATE TABLE "ScheduleDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftType" TEXT,
    "isLeave" BOOLEAN NOT NULL DEFAULT false,
    "leaveType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleDraft_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("staffId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DraftMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ScheduleDraft_date_idx" ON "ScheduleDraft"("date");

-- CreateIndex
CREATE INDEX "ScheduleDraft_staffId_idx" ON "ScheduleDraft"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDraft_date_staffId_key" ON "ScheduleDraft"("date", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftMonth_year_month_key" ON "DraftMonth"("year", "month");
