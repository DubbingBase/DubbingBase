#!/bin/bash

# Database backup script for Supabase
# Using password from environment variable or user prompt

# Get password from environment variable or prompt
if [ -z "$SUPABASE_PASSWORD" ]; then
    read -sp "Enter Supabase password: " SUPABASE_PASSWORD
    echo
fi

# Construct connection string
CONNECTION_STRING="postgresql://postgres:$SUPABASE_PASSWORD@db.rrjgbneefiwoqvsjwzrz.supabase.co:5432/postgres"

# Create backup directory with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Starting database backup to $BACKUP_DIR"

# Run supabase dump commands
echo "Dumping roles..."
if ! cd packages/database && supabase db dump --db-url "$CONNECTION_STRING" -f "../../$BACKUP_DIR/roles.sql" --role-only; then
    echo "Error: Failed to dump roles"
    exit 1
fi

echo "Dumping schema..."
if ! cd packages/database && supabase db dump --db-url "$CONNECTION_STRING" -f "../../$BACKUP_DIR/schema.sql"; then
    echo "Error: Failed to dump schema"
    exit 1
fi

echo "Dumping data..."
if ! cd packages/database && supabase db dump --db-url "$CONNECTION_STRING" -f "../../$BACKUP_DIR/data.sql" --use-copy --data-only; then
    echo "Error: Failed to dump data"
    exit 1
fi

echo "Backup completed successfully!"
echo "Files saved in $BACKUP_DIR:"
ls -l "$BACKUP_DIR"
