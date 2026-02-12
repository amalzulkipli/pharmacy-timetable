#!/bin/sh
set -e

# Check if we should force-replace the database from template
# Set FORCE_DB_SEED=true in env to overwrite existing DB with template
if [ "$FORCE_DB_SEED" = "true" ] && [ -f /app/prisma-template/pharmacy.db ]; then
  echo "FORCE_DB_SEED=true: Replacing database with template..."
  cp /app/prisma-template/pharmacy.db /app/prisma/pharmacy.db
  echo "Database replaced from template."
elif [ ! -f /app/prisma/pharmacy.db ]; then
  echo "Database not found, initializing from template..."
  cp /app/prisma-template/pharmacy.db /app/prisma/pharmacy.db
  echo "Database initialized."
else
  echo "Existing database found."
fi

# Apply any pending migrations to the database
echo "Running database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy
echo "Migrations complete."

echo "Starting application..."
exec node server.js
