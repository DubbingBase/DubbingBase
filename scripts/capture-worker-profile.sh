#!/usr/bin/env bash
set -euo pipefail

profile_type="${1:-}"
version_id="${2:-}"
duration_ms="${3:-50000}"
output_dir="${PROFILE_OUTPUT_DIR:-/tmp/dubbingbase-worker-profiles}"

if [[ "$profile_type" != "cpu" && "$profile_type" != "heap" ]]; then
  echo "Usage: $0 <cpu|heap> <active-version-id> [duration-ms]" >&2
  exit 2
fi

if [[ ! "$version_id" =~ ^[[:xdigit:]-]{8,}$ ]]; then
  echo "Provide an active Worker version ID; do not use 'latest'." >&2
  exit 2
fi

if [[ ! "$duration_ms" =~ ^[0-9]+$ ]] || (( duration_ms < 1000 || duration_ms > 50000 )); then
  echo "Duration must be an integer from 1000 to 50000 milliseconds." >&2
  exit 2
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" || -z "${CLOUDFLARE_READ_ONLY_TOKEN:-}" ]]; then
  echo "Run this through Doppler with CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_READ_ONLY_TOKEN." >&2
  exit 2
fi

mkdir -p "$output_dir"
python3 - "$profile_type" "$version_id" "$duration_ms" "$output_dir" <<'PY'
import gzip
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

profile_type, version_id, duration_ms, output_dir = sys.argv[1:]
worker_id = os.environ.get("WORKER_ID", "dubbingbase-website")
if not re.fullmatch(r"[A-Za-z0-9_-]+", worker_id):
    raise SystemExit("WORKER_ID contains unsupported characters")

stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
stem = f"{worker_id}-{version_id}-{profile_type}-{stamp}"
compressed_path = Path(output_dir) / f"{stem}.pprof.gz"
profile_path = Path(output_dir) / f"{stem}.pprof"
url = (
    "https://api.cloudflare.com/client/v4/accounts/"
    f"{os.environ['CLOUDFLARE_ACCOUNT_ID']}/workers/workers/{worker_id}/"
    f"versions/{version_id}/profile"
)
request = urllib.request.Request(
    url,
    data=json.dumps({"duration_ms": int(duration_ms), "profile_type": profile_type}).encode(),
    headers={
        "Authorization": f"Bearer {os.environ['CLOUDFLARE_READ_ONLY_TOKEN']}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=90) as response:
        compressed = response.read()
except urllib.error.HTTPError as error:
    details = error.read(2048).decode("utf-8", errors="replace")
    raise SystemExit(f"Cloudflare profile request failed: HTTP {error.code}: {details}")

if not compressed.startswith(b"\x1f\x8b"):
    profile = compressed
else:
    profile = gzip.decompress(compressed)
    compressed_path.write_bytes(compressed)
profile_path.write_bytes(profile)
if compressed_path.exists():
    print(f"Saved compressed profile: {compressed_path}")
print(f"Saved pprof profile: {profile_path}")
PY
