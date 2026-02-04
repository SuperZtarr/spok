#!/bin/sh

echo "DATABASE_URL=$DATABASE_URL"

echo "=== Starting migration ==="

# Step 1: Add new enum values if they don't exist
echo "Adding MEETING to enum if not exists..."
psql "$DATABASE_URL" -c "ALTER TYPE \"ItemType\" ADD VALUE IF NOT EXISTS 'MEETING';" || echo "MEETING already exists or error"

echo "Adding PERIOD to enum if not exists..."
psql "$DATABASE_URL" -c "ALTER TYPE \"ItemType\" ADD VALUE IF NOT EXISTS 'PERIOD';" || echo "PERIOD already exists or error"

# Step 2: Update existing APPOINTMENT items to MEETING
echo "Updating APPOINTMENT items to MEETING..."
psql "$DATABASE_URL" -c "UPDATE \"Item\" SET type = 'MEETING' WHERE type = 'APPOINTMENT';" || echo "No APPOINTMENT items to update"

# Step 3: Add startDate and endDate columns if they don't exist
echo "Adding startDate column if not exists..."
psql "$DATABASE_URL" -c "ALTER TABLE \"Item\" ADD COLUMN IF NOT EXISTS \"startDate\" TIMESTAMP(3);" || echo "startDate already exists or error"

echo "Adding endDate column if not exists..."
psql "$DATABASE_URL" -c "ALTER TABLE \"Item\" ADD COLUMN IF NOT EXISTS \"endDate\" TIMESTAMP(3);" || echo "endDate already exists or error"

# Step 4: Now we can run prisma db push
echo "=== Running Prisma db push ==="
./packages/database/node_modules/.bin/prisma db push \
  --schema=packages/database/prisma/schema.prisma \
  --accept-data-loss

echo "=== Starting API ==="
exec node apps/api/dist/index.js
