#!/bin/bash
set -e

cd "$(dirname "$0")"

# Creates required folders and removes .keep files to avoid mime-type errors during seed

for path in $(grep -oP 'objects_path\s*=\s*"\K[^"]+' supabase/config.toml); do
  folder="supabase/${path#./}"
  mkdir -p "$folder"
done
