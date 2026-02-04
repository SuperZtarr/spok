#!/bin/sh
set -e

echo "DATABASE_URL=$DATABASE_URL"

# Migrate APPOINTMENT to NOTE before schema push (if APPOINTMENT still exists)
echo "Migrating APPOINTMENT items to NOTE..."
psql "$DATABASE_URL" -c "UPDATE \"Item\" SET type = 'NOTE' WHERE type = 'APPOINTMENT';" || echo "Migration skipped (no APPOINTMENT or already migrated)"

# Push schema changes
echo "Pushing schema changes..."
./packages/database/node_modules/.bin/prisma db push \
  --schema=packages/database/prisma/schema.prisma \
  --accept-data-loss

# Start the API
echo "Starting API..."
exec node apps/api/dist/index.js
