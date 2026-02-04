#!/bin/sh
set -e

echo "DATABASE_URL=$DATABASE_URL"

# Migrate APPOINTMENT to NOTE before schema push (if APPOINTMENT still exists)
echo "UPDATE \"Item\" SET type = 'NOTE' WHERE type = 'APPOINTMENT';" | \
  ./packages/database/node_modules/.bin/prisma db execute \
  --schema=packages/database/prisma/schema.prisma \
  --stdin || true

# Push schema changes
./packages/database/node_modules/.bin/prisma db push \
  --schema=packages/database/prisma/schema.prisma \
  --accept-data-loss

# Start the API
exec node apps/api/dist/index.js
