-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "alEntitlement" INTEGER NOT NULL DEFAULT 14,
    "alUsed" REAL NOT NULL DEFAULT 0,
    "rlEarned" REAL NOT NULL DEFAULT 0,
    "rlUsed" REAL NOT NULL DEFAULT 0,
    "mlEntitlement" INTEGER NOT NULL DEFAULT 14,
    "mlUsed" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveBalance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("staffId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LeaveBalance" ("alEntitlement", "alUsed", "createdAt", "id", "rlEarned", "rlUsed", "staffId", "updatedAt", "year") SELECT "alEntitlement", "alUsed", "createdAt", "id", "rlEarned", "rlUsed", "staffId", "updatedAt", "year" FROM "LeaveBalance";
DROP TABLE "LeaveBalance";
ALTER TABLE "new_LeaveBalance" RENAME TO "LeaveBalance";
CREATE INDEX "LeaveBalance_staffId_idx" ON "LeaveBalance"("staffId");
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");
CREATE UNIQUE INDEX "LeaveBalance_staffId_year_key" ON "LeaveBalance"("staffId", "year");
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL,
    "defaultOffDays" TEXT NOT NULL,
    "alEntitlement" INTEGER NOT NULL DEFAULT 14,
    "mlEntitlement" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Staff" ("alEntitlement", "createdAt", "defaultOffDays", "id", "isActive", "name", "role", "staffId", "updatedAt", "weeklyHours") SELECT "alEntitlement", "createdAt", "defaultOffDays", "id", "isActive", "name", "role", "staffId", "updatedAt", "weeklyHours" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");
CREATE INDEX "Staff_staffId_idx" ON "Staff"("staffId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
