#!/usr/bin/env bash
set -euo pipefail

# Navigate to the script's directory (packages/database)
cd "$(dirname "$0")"

missing=0
missing_funcs=()

for index_file in $(find supabase/functions -maxdepth 2 -name "index.ts"); do
  func_name=$(basename $(dirname "$index_file"))
  if [ "$func_name" = "_shared" ]; then
    continue
  fi
  if ! grep -q -F "[functions.$func_name]" supabase/config.toml; then
    missing_funcs+=("$func_name")
    missing=$((missing + 1))
  fi
done

if [ "$missing" -ne 0 ]; then
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error::The following Edge Functions are not configured in supabase/config.toml:"
    for func in "${missing_funcs[@]}"; do
      echo "  - $func"
    done
  else
    echo "❌ Error: The following Edge Functions are not configured in supabase/config.toml:"
    for func in "${missing_funcs[@]}"; do
      echo "  - $func"
    done
  fi
  echo "Please add [functions.<name>] configuration with verify_jwt = false to packages/database/supabase/config.toml"
  exit 1
else
  echo "✅ All Edge Functions are properly configured in supabase/config.toml."
fi
