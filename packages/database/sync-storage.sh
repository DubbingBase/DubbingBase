#!/bin/bash
set -e

rm -rf /tmp/storage-seed-all
npx --yes supabase storage cp --experimental --linked -r ss:/// /tmp/storage-seed-all/
for bucket in /tmp/storage-seed-all/*/; do
  if [ -d "$bucket" ]; then
    bucket_name=$(basename "$bucket")
    
    # Remove local bucket if it exists to prevent double-nesting on upload
    npx supabase storage rm --experimental --local --yes -r "ss:///$bucket_name" || true
    
    # Upload the folder which creates the bucket cleanly
    npx supabase storage cp --experimental --local --yes -r "$bucket" ss:///
  fi
done
rm -rf /tmp/storage-seed-all
