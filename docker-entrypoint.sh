#!/bin/sh
set -e

DB_PATH="/app/prisma/pharmacy.db"

# Check if we should force-replace the database from template
# Set FORCE_DB_SEED=true in env to overwrite existing DB with template
if [ "$FORCE_DB_SEED" = "true" ] && [ -f /app/prisma-template/pharmacy.db ]; then
  echo "FORCE_DB_SEED=true: Replacing database with template..."
  cp /app/prisma-template/pharmacy.db "$DB_PATH"
  echo "Database replaced from template."
elif [ ! -f "$DB_PATH" ]; then
  echo "Database not found, initializing from template..."
  cp /app/prisma-template/pharmacy.db "$DB_PATH"
  echo "Database initialized."
else
  echo "Existing database found."
fi

# Apply pending schema migrations using sqlite3 directly
# This is more reliable than prisma CLI which has deep transitive dependencies
echo "Checking database schema..."

# Migration: add_custom_time_fields (customStartTime, customEndTime, customWorkHours)
if sqlite3 "$DB_PATH" "PRAGMA table_info('ScheduleOverride')" | grep -q customStartTime; then
  echo "  custom_time_fields: already applied"
else
  echo "  custom_time_fields: applying..."
  sqlite3 "$DB_PATH" <<'SQL'
ALTER TABLE "ScheduleDraft" ADD COLUMN "customEndTime" TEXT;
ALTER TABLE "ScheduleDraft" ADD COLUMN "customStartTime" TEXT;
ALTER TABLE "ScheduleDraft" ADD COLUMN "customWorkHours" REAL;
ALTER TABLE "ScheduleOverride" ADD COLUMN "customEndTime" TEXT;
ALTER TABLE "ScheduleOverride" ADD COLUMN "customStartTime" TEXT;
ALTER TABLE "ScheduleOverride" ADD COLUMN "customWorkHours" REAL;
SQL
  echo "  custom_time_fields: applied"
fi

echo "Schema up to date."
echo "Starting application..."
exec node server.js
