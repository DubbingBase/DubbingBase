#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Prepare the complete SQL snapshot for local restore and replace each local
# Storage bucket's files with the corresponding production bucket contents.

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
    
    # Replace the destination only after the remote download has succeeded.
    rm -rf "$folder"
    mkdir -p "$folder"

    # Copy the contents directly into the target folder to avoid nesting.
    if [ -d "$temp_dir/$bucket" ]; then
      cp -a "$temp_dir/$bucket/." "$folder/"
    fi
    
    rm -rf "$temp_dir"
    rm -f "$folder/.keep"
  fi
done

python3 prepare-production-data.py \
  .local/production-data.sql \
  .local/production-data-prepared.sql \
  .local/production-data-manifest.json
