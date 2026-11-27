#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

pnpm exec supabase storage cp --experimental --recursive ss:/// "$temp_dir/" --remote

# Recursive removal of a bucket root deletes the bucket itself. Remove only
# these project buckets, then restore their local definitions from config.toml.
for bucket in \
  gamification_uploads \
  project_attachments \
  studio_logos \
  voice_actor_profile_pictures; do
  pnpm exec supabase storage rm --experimental --recursive --yes "ss:///$bucket"
done

pnpm exec supabase seed buckets --yes

for bucket_path in "$temp_dir"/*; do
  [ -d "$bucket_path" ] || continue
  pnpm exec supabase storage cp --experimental --yes --recursive "$bucket_path" ss:///
done
