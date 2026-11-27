#!/bin/bash

# Database backup script for Supabase
# Using password from environment variable or user prompt

# Doppler's production config exposes the password as SUPABASE_DB_PASSWORD
SUPABASE_PASSWORD="${SUPABASE_PASSWORD:-$SUPABASE_DB_PASSWORD}"

# Get password from environment variable or prompt
if [ -z "$SUPABASE_PASSWORD" ]; then
    read -sp "Enter Supabase password: " SUPABASE_PASSWORD
    echo
fi


# Create backup directory with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Starting database backup to $BACKUP_DIR"

# Run supabase dump commands
echo "Dumping roles..."
if ! pnpm --filter @app/supabase exec supabase db dump --password "$SUPABASE_PASSWORD" -f "../../$BACKUP_DIR/roles.sql" --role-only --remote; then
    echo "Error: Failed to dump roles"
    exit 1
fi

echo "Dumping schema..."
if ! pnpm --filter @app/supabase exec supabase db dump --password "$SUPABASE_PASSWORD" -f "../../$BACKUP_DIR/schema.sql" --remote; then
    echo "Error: Failed to dump schema"
    exit 1
fi

echo "Dumping data..."
if ! pnpm --filter @app/supabase exec supabase db dump --password "$SUPABASE_PASSWORD" -f "../../$BACKUP_DIR/data.sql" --use-copy --data-only --remote; then
    echo "Error: Failed to dump data"
    exit 1
fi

echo "Backup completed successfully!"
echo "Files saved in $BACKUP_DIR:"
ls -l "$BACKUP_DIR"
