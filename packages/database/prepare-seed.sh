#!/bin/bash
set -e

cd "$(dirname "$0")"

# Creates required folders and removes .keep files to avoid mime-type errors during seed

for bucket in $(grep -oP '\[storage\.buckets\.\K[^\]]+' supabase/config.toml); do
  path=$(awk -v b="$bucket" '
    $0 ~ "\\[storage\\.buckets\\." b "\\]" { found=1 }
    found && $1 == "objects_path" { gsub(/"/, "", $3); print $3; exit }
  ' supabase/config.toml)
  
  if [ -n "$path" ]; then
    folder="supabase/${path#./}"
    mkdir -p "$folder"
    
    echo "Downloading remote bucket '$bucket'..."
    temp_dir=$(mktemp -d)
    
    # Supabase CLI creates a subfolder for the bucket inside the target directory
    npx --yes supabase storage cp --experimental --linked -r "ss:///$bucket/" "$temp_dir/" || true
    
    # Copy the contents directly into the target folder to avoid nesting
    if [ -d "$temp_dir/$bucket" ]; then
      cp -a "$temp_dir/$bucket/." "$folder/"
    fi
    
    rm -rf "$temp_dir"
    rm -f "$folder/.keep"
  fi
done
