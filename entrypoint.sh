#!/bin/sh
set -e

echo "▶ Running DB migrations..."
prisma migrate deploy --schema=./prisma/schema.prisma

echo "▶ Starting MeetSync..."
exec node server.js
