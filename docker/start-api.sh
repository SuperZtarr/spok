#!/bin/sh

echo "=== Running Prisma db push ==="
./packages/database/node_modules/.bin/prisma db push \
  --schema=packages/database/prisma/schema.prisma \
  --accept-data-loss

echo "=== Starting API ==="
exec node apps/api/dist/index.js
