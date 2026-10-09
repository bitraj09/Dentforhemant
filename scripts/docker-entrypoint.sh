#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is required when RUN_DB_MIGRATIONS=true"
    exit 1
  fi

  echo "Running Prisma migrations..."
  npx prisma migrate deploy
fi

if [ "${SEED_DEFAULT_ADMIN:-false}" = "true" ]; then
  echo "Ensuring the default admin account exists..."
  node ./scripts/seed-default-admin.js
fi

echo "Starting Next.js server..."
exec node server.js
