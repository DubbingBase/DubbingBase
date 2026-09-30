#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

npx supabase storage cp --experimental --linked --recursive ss:/// "$temp_dir/"

# Recursive removal of a bucket root deletes the bucket itself. Remove only
# these project buckets, then restore their local definitions from config.toml.
for bucket in \
  gamification_uploads \
  project_attachments \
  studio_logos \
  voice_actor_profile_pictures; do
  npx supabase storage rm --experimental --local --recursive --yes "ss:///$bucket"
done

npx supabase seed buckets --local --yes

for bucket_path in "$temp_dir"/*; do
  [ -d "$bucket_path" ] || continue
  npx supabase storage cp --experimental --local --yes --recursive "$bucket_path" ss:///
done
