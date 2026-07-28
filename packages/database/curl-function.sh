#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME=""
BODY=""

usage() {
  echo "Usage: curl-function <function-name> [--body <json-body> | --body @<file>]"
  echo ""
  echo "Easily curl a Supabase edge function from the CLI."
  echo ""
  echo "Requires the following env vars to be set (via .env.development):"
  echo "  SUPABASE_URL             - e.g. http://127.0.0.1:55321"
  echo "  SUPABASE_PUBLISHABLE_KEY - the publishable (anon) key"
  echo ""
  echo "Options:"
  echo "  function-name   Name of the edge function to invoke"
  echo "  --body <json>   JSON body to send in the request"
  echo "  --body @<file>  Read JSON body from a file ('@' prefix required)"
  echo ""
  echo "Examples:"
  echo "  curl-function extract-voice-actor-info --body '{\"wikipediaUrl\": \"https://en.wikipedia.org/wiki/Some_Actor\"}'"
  echo "  curl-function get-media-credits --body '{\"media_type\": \"movie\", \"media_id\": 123}'"
  echo "  echo '{\"query\": \"actor\"}' | curl-function search"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --body)
      shift
      if [ -z "${1:-}" ]; then
        echo "Error: --body requires a value" >&2
        exit 1
      fi
      BODY="$1"
      shift
      ;;
    -h | --help)
      usage
      ;;
    *)
      if [ -z "$FUNCTION_NAME" ]; then
        FUNCTION_NAME="$1"
        shift
      else
        echo "Error: unexpected argument '$1'" >&2
        usage
      fi
      ;;
  esac
done

if [ -z "$FUNCTION_NAME" ]; then
  echo "Error: function name is required" >&2
  usage
fi

URL="${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}"

if [ -z "$BODY" ]; then
  if [ ! -t 0 ]; then
    BODY=$(cat)
  fi
fi

if [ -n "$BODY" ]; then
  if [[ "$BODY" == @* ]]; then
    BODY_FILE="${BODY#@}"
    if [ ! -f "$BODY_FILE" ]; then
      echo "Error: body file '$BODY_FILE' not found" >&2
      exit 1
    fi
    BODY=$(cat "$BODY_FILE")
  fi
fi

ARGS=(-s -w "\n%{http_code}" -X POST "$URL" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_PUBLISHABLE_KEY}")

if [ -n "$BODY" ]; then
  ARGS+=(-d "$BODY")
fi

RESPONSE=$(curl "${ARGS[@]}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_RESPONSE=$(echo "$RESPONSE" | sed '$d')

echo "$BODY_RESPONSE" | jq . 2>/dev/null || echo "$BODY_RESPONSE"

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "" >&2
  echo "HTTP status: $HTTP_CODE" >&2
  exit 1
fi