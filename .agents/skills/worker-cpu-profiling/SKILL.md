---
name: worker-cpu-profiling
description: Capture production CPU and heap profiles for the DubbingBase website Worker with the read-only Cloudflare token, and interpret what the profiles can and cannot show.
---

# DubbingBase Worker CPU Profiling

Use this runbook when investigating CPU spikes in the production website Worker. The profile API is separate from Workers Logs: a read-only profile capture can work while the Cloudflare dashboard says Observability is disabled.

## Current production limits

- `apps/website/wrangler.toml` uploads source maps for each deployed Worker version so CPU profiles can use readable source names. Maps can contain bundled server source and remain attached to private Worker versions; they are not public assets.
- CPU and heap profiles can still be captured through the Cloudflare profile API with a token that has Workers Scripts Read / Content Read-Only access.
- Source maps only help versions deployed after this setting is enabled. Until CI deploys a new version, the active version may still show generated bundle frames. Do not claim source-level function attribution unless the capture is symbolized.
- The profile covers sampled work on one active isolate. It does not associate stack samples with individual request paths.
- Workers Logs permanently stores 10% of invocation events, with query strings redacted; traces remain disabled. This gives short-term history for request path, CPU, wall time, and outcome. The bounded `wrangler tail` helper remains available for a denser live sample and only saves sanitized records under `/tmp`.

## Capture a production profile

1. Confirm Doppler has the read-only fields without displaying values:

   ```sh
   doppler secrets --project dubbingbase --config prd --only-names
   ```

   Required names: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_READ_ONLY_TOKEN`. Never print the token or put it in a repository file.

2. Find the version receiving traffic in the latest active deployment. Do not use `latest`, because it can refer to a newer uploaded version that is not deployed:

   ```sh
   doppler run --project dubbingbase --config prd -- python3 - <<'PY'
   import json
   import os
   from urllib.request import Request, urlopen

   url = (
       "https://api.cloudflare.com/client/v4/accounts/"
       f"{os.environ['CLOUDFLARE_ACCOUNT_ID']}/workers/scripts/"
       "dubbingbase-website/deployments"
   )
   request = Request(url, headers={
       "Authorization": f"Bearer {os.environ['CLOUDFLARE_READ_ONLY_TOKEN']}"
   })
   with urlopen(request, timeout=30) as response:
       deployments = json.load(response)["result"]["deployments"]

   deployment = deployments[0]
   print("deployed_at", deployment.get("created_on", "unknown"))
   for version in deployment["versions"]:
       if version.get("percentage", 0) > 0:
           print(version["version_id"], version["percentage"])
   PY
   ```

   Check the deployment timestamp if more than one version is receiving traffic. Record the active version ID and UTC capture interval.

3. Capture a 50-second CPU profile while the Worker is receiving representative traffic:

   ```sh
   doppler run --project dubbingbase --config prd -- \
     bash scripts/capture-worker-profile.sh cpu <ACTIVE_VERSION_ID> 50000
   ```

   Use `heap` instead of `cpu` to inspect allocation stacks. Captures must be 1,000–50,000 ms. The helper saves the pprof under `/tmp/dubbingbase-worker-profiles` by default and preserves the compressed response when Cloudflare returns one. It does not change Worker configuration.

   The API returns HTTP 429 when rate limited; wait for `Retry-After` before retrying. “No recent executions” or “no loaded isolate” means the selected version needs recent traffic before another capture.

4. Inspect the profile with `go tool pprof -top /tmp/dubbingbase-worker-profiles/<profile>.pprof` when available. For readable file and line names, the source maps must be uploaded for that exact deployed version. Cloudflare dashboard flamegraphs are also available under **Workers & Pages → dubbingbase-website → Observability → Flamegraph** when that UI is enabled.

5. Capture a short real-time tail during the same UTC window to rank routes by per-invocation CPU. This does not persist logs in Cloudflare. It discards headers, query strings, and identifying numeric/UUID path segments, and writes only reduced events to `/tmp`:

   ```sh
   doppler run --project dubbingbase --config prd -- \
     bash scripts/capture-worker-tail.sh <ACTIVE_VERSION_ID> 300 0.9
   ```

   The arguments are active version ID, duration in seconds (1–900), and sample rate (greater than 0 and less than 1). Inspect only the sanitized file; delete it when analysis is complete.

## Inspect persistent sampled invocation logs

In **Workers & Pages → dubbingbase-website → Observability → Events**, select a time range and inspect invocation events. Logs are sampled at 10%, retain query-string redaction, and include route, CPU time, wall time, and outcome. Use these events to find when CPU rose and which routes were active, then capture a profile and sanitized tail during a matching busy window. The current Cloudflare plan retains Workers Logs for up to 3 days on Free or 7 days on Paid; check account usage if traffic grows. Traces are disabled.

Use the dashboard for historical log queries. Cloudflare's Workers Observability REST query endpoint currently requires the `Workers Observability Write` token permission even for a read query, so do not use it with or broaden the Doppler read-only profiling token. `wrangler tail` remains the read-only CLI path for live captures.

For source-level function attribution, use **Observability → Flamegraph** on a deployed version with source maps. The pprof API may produce only idle/runtime samples when its selected isolate was not busy; do not treat a GC-only or idle-only capture as evidence of an application hotspot. Repeat during representative traffic or use the dashboard flamegraph when source-mapped function names are needed.

## Deployment when E2E browser installation stalls

The regular main push still requires every release check, including E2E. If a user explicitly authorizes proceeding while only E2E is pending, first confirm the push run is still blocked installing Playwright browsers and no deployment or migration job is active, then cancel that run; main workflow runs are serialized, so the manual run otherwise waits behind it. Manually dispatch **Release and Deployment Pipeline** on `main` with `force_website_deploy` and `allow_e2e_pending` enabled, and set `database_baseline_sha` to the head SHA of the latest successful main release. The workflow verifies that this baseline is an ancestor and that no `packages/database/` files changed since it. If the check fails, use the regular release path. For an accepted website-only override, the workflow forces website checks, keeps applicable local database validation, skips production database deployment, and skips only E2E. Website lint, typecheck, frontend tests, i18n, build, release validation, and any applicable local database checks still have to pass before deployment.

## Route attribution

Use the tail's sampled per-invocation CPU to rank routes during the capture window. Compare those route patterns with the CPU pprof from the same active version and UTC window. A profile can show Worker function stacks, but it cannot link each stack sample to a route; present route-to-function conclusions as correlation, not request-level proof. Cloudflare GraphQL can add aggregate Worker CPU and request metrics, while HTTP Analytics route groups add request volume.

Only request persistent Workers Logs when historical investigation across separate runs is needed. It changes data retention and may incur usage charges; query strings should remain redacted and traces can stay disabled.

## References

- [Cloudflare production profiling](https://developers.cloudflare.com/workers/observability/profiling-in-production/)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare real-time logs and `wrangler tail`](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
- [Wrangler observability configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#observability)
