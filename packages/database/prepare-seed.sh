#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Remove Storage rows from the SQL seed because bucket configuration and object
# files are restored through Supabase Storage, then replace local bucket files.

for bucket in $(grep -oP '\[storage\.buckets\.\K[^\]]+' supabase/config.toml); do
  path=$(awk -v b="$bucket" '
    $0 ~ "\\[storage\\.buckets\\." b "\\]" { found=1 }
    found && $1 == "objects_path" { gsub(/"/, "", $3); print $3; exit }
  ' supabase/config.toml)
  
  if [ -n "$path" ]; then
    folder="supabase/${path#./}"

    echo "Downloading remote bucket '$bucket'..."
    temp_dir=$(mktemp -d)

    # Supabase CLI creates a subfolder for the bucket inside the target directory
    if ! npx --yes supabase storage cp --experimental --linked -r "ss:///$bucket/" "$temp_dir/" >/dev/null 2>&1; then
      rm -rf "$temp_dir"
      echo "Failed to download remote bucket '$bucket'." >&2
      exit 1
    fi

    # Stage the replacement beside the destination so rename stays on one filesystem.
    mkdir -p "$(dirname "$folder")"
    staged_dir=$(mktemp -d "$(dirname "$folder")/.${bucket}.replacement.XXXXXX")
    if [ -d "$temp_dir/$bucket" ]; then
      if ! cp -a "$temp_dir/$bucket/." "$staged_dir/"; then
        rm -rf "$temp_dir" "$staged_dir"
        echo "Failed to stage remote bucket '$bucket'." >&2
        exit 1
      fi
    fi

    # Keep the old bucket until the downloaded replacement has been copied.
    backup_dir=$(mktemp -d "$(dirname "$folder")/.${bucket}.backup.XXXXXX")
    rmdir "$backup_dir"
    if [ -e "$folder" ]; then
      mv "$folder" "$backup_dir"
    else
      backup_dir=""
    fi

    if ! mv "$staged_dir" "$folder"; then
      if [ -n "$backup_dir" ]; then
        mv "$backup_dir" "$folder"
      fi
      rm -rf "$temp_dir" "$staged_dir"
      echo "Failed to install downloaded bucket '$bucket'." >&2
      exit 1
    fi
    if [ -n "$backup_dir" ]; then
      rm -rf "$backup_dir"
    fi

    rm -rf "$temp_dir"
    rm -f "$folder/.keep"
  fi
done

# Supabase's data dump includes these rows, while local Storage restores them
# from configured bucket paths.
perl -0777 -pi -e 's/INSERT INTO "storage"\."buckets".*?;//gs' supabase/seed.sql
perl -0777 -pi -e 's/INSERT INTO "storage"\."objects".*?;//gs' supabase/seed.sql
