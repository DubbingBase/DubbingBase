#!/usr/bin/env bash

echo -e "\033[0;31m========================================================================\033[0m"
echo -e "\033[1;31m⚠️  WARNING: YOU ARE ABOUT TO ENQUEUE DATA INTO THE PRODUCTION DATABASE! ⚠️\033[0m"
echo -e "\033[0;31m========================================================================\033[0m"
echo ""
echo "This will use the variables defined in .env.production"
echo "It will also use a separate progress file: ./scripts/progress.prod.json"
echo ""
echo -n "Are you absolutely sure you want to continue? (type 'yes' to confirm): "
read confirmation
if [ "$confirmation" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

export PROGRESS_FILE="./scripts/progress.prod.json"
npx --yes tsx scripts/fetch_wikipedia_dubbing.ts
