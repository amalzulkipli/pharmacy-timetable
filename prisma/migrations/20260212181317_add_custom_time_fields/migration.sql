-- AlterTable
ALTER TABLE "ScheduleDraft" ADD COLUMN "customEndTime" TEXT;
ALTER TABLE "ScheduleDraft" ADD COLUMN "customStartTime" TEXT;
ALTER TABLE "ScheduleDraft" ADD COLUMN "customWorkHours" REAL;

-- AlterTable
ALTER TABLE "ScheduleOverride" ADD COLUMN "customEndTime" TEXT;
ALTER TABLE "ScheduleOverride" ADD COLUMN "customStartTime" TEXT;
ALTER TABLE "ScheduleOverride" ADD COLUMN "customWorkHours" REAL;
