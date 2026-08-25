#!/usr/bin/env bash

if [ -f ".env.production" ]; then
  set -a
  source .env.production
  set +a
else
  echo "❌ Error: .env.production file not found in the root directory!"
  exit 1
fi

echo -e "\033[0;31m========================================================================\033[0m"
echo -e "\033[1;31m⚠️  WARNING: YOU ARE ABOUT TO ENQUEUE DATA INTO THE PRODUCTION DATABASE! ⚠️\033[0m"
echo -e "\033[0;31m========================================================================\033[0m"
echo ""
WIKI_LANG="${WIKI_LANG:-fr}"
PROGRESS_FILE="./scripts/progress.prod.${WIKI_LANG}.json"

echo "This will use the variables defined in .env.production"
echo "It will also use a separate progress file: ${PROGRESS_FILE} (WIKI_LANG=${WIKI_LANG})"
echo ""
echo -n "Are you absolutely sure you want to continue? (type 'yes' to confirm): "
read confirmation
if [ "$confirmation" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

export PROGRESS_FILE
npx --yes tsx scripts/fetch_wikipedia_dubbing.ts
