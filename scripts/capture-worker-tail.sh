#!/usr/bin/env bash
set -euo pipefail

version_id="${1:-}"
duration_seconds="${2:-300}"
sampling_rate="${3:-0.9}"
worker_id="${WORKER_ID:-dubbingbase-website}"
output_dir="${PROFILE_OUTPUT_DIR:-/tmp/dubbingbase-worker-profiles}"

if [[ ! "$version_id" =~ ^[[:xdigit:]-]{8,}$ ]]; then
  echo "Usage: $0 <active-version-id> [duration-seconds] [sampling-rate]" >&2
  echo "Provide an active Worker version ID; do not use 'latest'." >&2
  exit 2
fi

if [[ ! "$duration_seconds" =~ ^[0-9]+$ ]] || (( duration_seconds < 1 || duration_seconds > 900 )); then
  echo "Duration must be an integer from 1 to 900 seconds." >&2
  exit 2
fi

if [[ ! "$sampling_rate" =~ ^[0-9]+([.][0-9]+)?$ ]] || \
  ! awk -v rate="$sampling_rate" 'BEGIN { exit !(rate > 0 && rate < 1) }'; then
  echo "Sampling rate must be greater than 0 and less than 1." >&2
  exit 2
fi

if [[ ! "$worker_id" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "WORKER_ID contains unsupported characters." >&2
  exit 2
fi

if [[ -z "${CLOUDFLARE_READ_ONLY_TOKEN:-}" ]]; then
  echo "Run this through Doppler with CLOUDFLARE_READ_ONLY_TOKEN." >&2
  exit 2
fi

command -v jq >/dev/null || { echo "jq is required." >&2; exit 2; }
command -v timeout >/dev/null || { echo "timeout is required." >&2; exit 2; }

mkdir -p "$output_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tail_path="$output_dir/tail-${worker_id}-${version_id}-${stamp}.jsonl"

export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_READ_ONLY_TOKEN"
export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-/tmp/dubbingbase-wrangler}"

set +e
timeout --signal=INT --kill-after=5s "${duration_seconds}s" \
  mise exec -- pnpm --filter=@app/website exec wrangler tail "$worker_id" \
    --format json --version-id "$version_id" --sampling-rate "$sampling_rate" \
| jq --unbuffered -c '
    select(.event.request.url? != null)
    | (.event.request.url | sub("\\?.*$"; "") | sub("^https?://[^/]+"; "") | split("/")) as $segments
    | {
        timestamp: (.eventTimestamp // .timestamp // null),
        version: (.scriptVersion.id // .versionId // null),
        method: (.event.request.method // null),
        pathTemplate: (
          $segments
          | to_entries
          | map(
              if .key > 0 and $segments[.key - 1] == "season" then ":season"
              elif .key > 0 and $segments[.key - 1] == "episode" then ":episode"
              elif (.value | test("^[0-9]+$") or test("^[a-fA-F0-9-]{32,}$")) then ":id"
              else .value
              end
            )
          | join("/")
        ),
        cpuTimeMs: (.cpuTime // .cpuTimeMs // .event.cpuTime // .event.cpuTimeMs // null),
        wallTimeMs: (.wallTime // .wallTimeMs // .event.wallTime // .event.wallTimeMs // null),
        outcome: (.outcome // null)
      }
  ' > "$tail_path"
pipeline_status=("${PIPESTATUS[@]}")
set -e

tail_status="${pipeline_status[0]}"
jq_status="${pipeline_status[1]}"
if (( jq_status != 0 )); then
  echo "Failed to sanitize Wrangler tail output (jq exit $jq_status)." >&2
  exit "$jq_status"
fi
if (( tail_status != 0 && tail_status != 124 && tail_status != 130 )); then
  echo "Wrangler tail exited unexpectedly (exit $tail_status)." >&2
  exit "$tail_status"
fi

printf 'Saved %s sanitized invocations to %s\n' "$(wc -l < "$tail_path" | tr -d ' ')" "$tail_path"
