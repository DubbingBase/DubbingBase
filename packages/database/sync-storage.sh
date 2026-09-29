#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

npx supabase storage cp --experimental --linked --recursive ss:/// "$temp_dir/"

local_listing=$(npx supabase storage ls --experimental --local --recursive ss:///)
mapfile -d '' -t local_objects < <(
  printf '%s' "$local_listing" | python3 -c '
import json, sys
paths = json.load(sys.stdin)["paths"]
for path in paths:
    if not path.endswith("/"):
        sys.stdout.buffer.write(("ss://" + (path if path.startswith("/") else "/" + path)).encode() + b"\0")
'
)
if [ "${#local_objects[@]}" -gt 0 ]; then
  npx supabase storage rm --experimental --local --yes "${local_objects[@]}"
fi

for bucket_path in "$temp_dir"/*; do
  [ -d "$bucket_path" ] || continue
  first_file=$(find "$bucket_path" -type f -print -quit)
  [ -n "$first_file" ] || continue
  npx supabase storage cp --experimental --local --yes --recursive "$bucket_path" ss:///
done
