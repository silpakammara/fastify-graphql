#!/bin/bash

# Database connection details
DB_HOST="clouddataworld.com"
DB_PORT="5432"
DB_NAME="sarvail_auth"
DB_USER="sarvail-user"
DB_PASS='Sarvail$1974'

echo "Running database migrations..."

# Run each migration in order
for migration in src/db/migrations/*.sql; do
    echo "Running migration: $migration"
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration"
    if [ $? -eq 0 ]; then
        echo "✓ Migration completed successfully"
    else
        echo "✗ Migration failed"
        exit 1
    fi
done

echo "All migrations completed successfully!"