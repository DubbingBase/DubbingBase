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

3. Capture through Cloudflare's `cf` CLI while the Worker is receiving representative traffic, ideally during the known high-CPU window (08:00–14:00 UTC):

   ```sh
   # Install the separate Cloudflare CLI if it is not available: npm install --global cf
   doppler run --project dubbingbase --config prd -- bash -lc '
     export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_READ_ONLY_TOKEN"
     mkdir -p /tmp/dubbingbase-worker-profiles
     cf workers versions profile "<ACTIVE_VERSION_ID>" \
       --worker-id dubbingbase-website \
       --duration-ms 50000 \
       --profile-type cpu \
       > /tmp/dubbingbase-worker-profiles/dubbingbase-website-cpu.pprof
   '
   ```

   Replace `<ACTIVE_VERSION_ID>` with the deployed UUID from step 2. `cf` is a separate CLI from Wrangler; it reads `CLOUDFLARE_API_TOKEN`, so map Doppler's `CLOUDFLARE_READ_ONLY_TOKEN` only in this command. The token needs Workers Scripts Read access. Do not use `cf auth login` or persist the token. The CLI writes raw pprof data to standard output. Capture records live work on one active isolate; it neither replays past requests nor associates stack samples with request paths. Ensure representative traffic is reaching the Worker before and during the capture.

   To generate a small, controlled stream for the movie route, start Autocannon alongside the profile and sanitized tail:

   ```sh
   mise exec -- npm exec --yes --package=autocannon@8.0.0 -- autocannon \
     -c 1 -R 1 -O 70 -d 70 -t 10 -j \
     -H 'User-Agent=DubbingBase-CPU-Profiling/1' \
     https://dubbingbase.com/movie/550 \
     > /tmp/dubbingbase-worker-profiles/autocannon-movie.json
   ```

   This caps the sample at one connection, one request per second, and 70 requests. The default Autocannon User-Agent received HTTP 403 at Cloudflare before reaching the Worker; the profiling User-Agent above returned HTTP 200. Check `statusCodeStats` and confirm there are no errors, timeouts, or non-2xx responses before treating the run as Worker traffic. Start Autocannon first, then capture the 50-second profile while it is running.

4. The existing helper is an alternative if `cf` is unavailable. It captures through the read-only profile API:

   ```sh
   doppler run --project dubbingbase --config prd -- \
     bash scripts/capture-worker-profile.sh cpu <ACTIVE_VERSION_ID> 50000
   ```

   Use `heap` instead of `cpu` to inspect allocation stacks. Captures must be 1,000–50,000 ms. The helper saves the pprof under `/tmp/dubbingbase-worker-profiles` by default and preserves the compressed response when Cloudflare returns one. It does not change Worker configuration.

   The API returns HTTP 429 when rate limited; wait for `Retry-After` before retrying. “No recent executions” or “no loaded isolate” means the selected version needs recent traffic before another capture.

5. Inspect the profile with `go tool pprof -top /tmp/dubbingbase-worker-profiles/<profile>.pprof` when available. To annotate a source-mapped frame against this checkout, use `go tool pprof -source_path=apps/website -list=<FUNCTION> <profile>.pprof`; for example, `-list=nextPage` mapped the captured movie-page render frame to `src/components/PaginatedResponsiveGrid.vue`. Check both flat and cumulative values: cumulative time includes callees. Cloudflare dashboard flamegraphs are also available under **Workers & Pages → dubbingbase-website → Observability → Flamegraph** when that UI is enabled. If the pprof shows only `(idle)` or garbage-collector samples, the selected isolate did not capture useful application work; repeat during a busier interval rather than attributing CPU to a function.

6. Capture a short real-time tail during the same UTC window to rank routes by per-invocation CPU. This does not persist logs in Cloudflare. It discards headers, query strings, and identifying numeric/UUID path segments, and writes only reduced events to `/tmp`:

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

## Evaluate a CPU optimization

Before changing code, write down the route and source-level hypothesis separately. The route tail identifies which requests used CPU; the pprof identifies functions sampled on one isolate. Neither alone proves that a named function caused the route's CPU.

For a production before/after comparison:

1. Record the active deployed version, UTC interval, route pattern, sample count, status/error counts, and per-invocation CPU distribution from the sanitized tail. Keep profile files outside Git.
2. Capture the baseline before the change, then repeat after the change is deployed. Keep the route, request shape, rate, concurrency, duration, sampling rate, and cache state as close as practical. Use comparable traffic windows and the same capture commands; disclose any differences.
3. Compare route CPU distributions and response outcomes. Use pprof to confirm which source-mapped functions were sampled on the selected isolate, but do not assign a stack to a particular route. Treat small or unmatched samples as inconclusive.
4. Preserve the default/full API response while optimizing a page projection. Add focused regressions for both the optimized projection and the unprojected behavior, and include a website Changeset with each code PR.

If comparable production samples are unavailable, use a local synthetic benchmark to test the specific algorithm or projection with representative input sizes. Record the workload shape, iterations, warmup, output size where relevant, and timing method. Label those results as synthetic; they support the code-level hypothesis but do not establish production CPU savings. Keep a candidate only when its behavior is covered and the measured workload shows a useful reduction. After deployment, collect a matched route tail before describing its production impact.

### Attribute route traffic sources with zone analytics

Use Cloudflare's read-only GraphQL Analytics API to identify the visitors behind the high-CPU page routes. Get the zone ID with `GET /zones?name=dubbingbase.com` using the same Doppler token, then query `httpRequestsAdaptiveGroups` for the same UTC window as Worker CPU metrics:

```graphql
query RouteSources($zoneTag: string!, $start: Time!, $end: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: 5000
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          clientRequestHTTPHost_in: ["dubbingbase.com", "www.dubbingbase.com"]
          OR: [
            { clientRequestPath_ilike: "%/movie/%" }
            { clientRequestPath_ilike: "%/actor/%" }
            { clientRequestPath_ilike: "%/show/%" }
          ]
          requestSource: "eyeball"
        }
      ) {
        confidence(level: 0.95) {
          count {
            estimate
            lower
            upper
            isValid
            sampleSize
          }
        }
        dimensions {
          datetimeHour
          verifiedBotCategory
        }
      }
    }
  }
}
```

`requestSource: "eyeball"` excludes `earlyHintsCache` requests. Use `datetimeHour` and `verifiedBotCategory` to compare categories with Worker CPU. Run a second query over the same filter with `dimensions { userAgent verifiedBotCategory clientCountryName userAgentBrowser }` to identify named crawlers. Run the path filter separately for each route family to compare actor, movie, and show traffic. Avoid grouping a full week by raw path unless you need a bounded path sample; IDs create many groups. These are adaptively sampled estimates, not exact request totals. Use confidence bounds, and report correlations as associations rather than proof that a source caused CPU.

With the current read-only token, `clientAsn`, `clientASNDescription`, and `botManagementDecision` return authorization errors. Keep the profiling token read-only and avoid retrieving visitor IPs; use the verified bot category, browser family, country, and user agent fields the token permits. An `Unknown` browser or empty bot category does not establish automated traffic. ASN-level attribution requires Cloudflare credentials or a signed-in dashboard with access to those fields.

Only request persistent Workers Logs when historical investigation across separate runs is needed. It changes data retention and may incur usage charges; query strings should remain redacted and traces can stay disabled.

## References

- [Cloudflare production profiling](https://developers.cloudflare.com/workers/observability/profiling-in-production/)
- [Cloudflare CLI profiling instructions](https://developers.cloudflare.com/workers/observability/profiling-in-production/#use-cloudflare-cli)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare real-time logs and `wrangler tail`](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
- [Wrangler observability configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#observability)
