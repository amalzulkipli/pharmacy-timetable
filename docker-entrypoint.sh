#!/bin/sh
set -e

# Initialize database from template if it doesn't exist (fresh volume mount)
if [ ! -f /app/prisma/pharmacy.db ]; then
  echo "Database not found, initializing from template..."
  cp /app/prisma-template/pharmacy.db /app/prisma/pharmacy.db
  echo "Database initialized."
else
  echo "Existing database found."
fi

echo "Starting application..."
exec node server.js
