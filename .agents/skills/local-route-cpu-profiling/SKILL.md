---
name: local-route-cpu-profiling
description: Profile real DubbingBase website routes locally with deterministic upstream mocks and V8 CPU profiles. Use when measuring a route or validating a route-level performance change; this does not profile production Workers.
---

# Local website route CPU profiling

Use this protocol for any DubbingBase website route the user asks to measure. It exercises the built Nuxt/Nitro server and the route's real TypeScript code with synthetic inputs. Results describe that local Node workload; they are not Cloudflare Worker measurements.

For production Worker profiles, use [worker-cpu-profiling](../worker-cpu-profiling/SKILL.md) instead.

## 1. Scope the route and workload

1. Read the active Plane task, comments, and relevant PRs before measuring. Record the question the profile must answer and keep findings in that Plane item.
2. Trace the user-facing page route to its server API handlers, composables, server utilities, and relevant middleware. Decide whether to measure the API handler, the rendered Nuxt page, or both. A direct handler profile does not include SSR rendering or payload serialization.
3. Identify code paths that can substitute fixtures or bypass the handler, including E2E middleware, route mocks, caches, and prerendered output. Confirm how to prove that the intended code and mocked dependencies ran.
4. Create deterministic, in-memory upstream fixtures with a representative workload and a larger workload appropriate to that route. Keep identifiers, data ordering, response shape, and locale stable across runs. Include a unique marker in each fixture so a response can be checked.

Do not reuse another route's fixture sizes as defaults. For example, the actor workload used 640 credits / 24 voice roles / 8 unique voice actors and 1,200 / 500 / 100; other routes need sizes based on their own data and hot path.

## 2. Build and isolate the local server

- Build only the website with `mise run check`. This task runs the website build and does not include `apps/mobile`. Keep build-time egress blocked too when prerendering, font discovery, or hooks could call remote services; use dummy values and do not load production credentials.
- Profile the built Nitro Node server (`node-server` preset), not the Cloudflare Worker runtime. Use a temporary local config override when needed to disable scheduled tasks, prerender output for a dynamic target route, or remote font discovery. Keep these overrides out of tracked application config.
- Run the built server and request/profile driver inside a loopback-only network namespace or equivalent OS-level egress block. Bind the server and inspector to `127.0.0.1`; use dummy local environment values, never production credentials. If external egress cannot be blocked, stop and report the limitation instead of profiling.
- Install a strict upstream `fetch` stub before the server starts. Allow only the exact provider hosts and paths required by the route, return the deterministic fixtures, count each allowed call, and throw on every other request. Also block external networking at the OS level; a fetch stub alone is not a network boundary.
- Leave `E2E_TEST` unset or false for route profiling. In this repository, `E2E_TEST=true` activates middleware that can return a canned API response before the real handler runs and disables scheduled tasks. Disable scheduled tasks through the temporary profiling config instead. Inspect equivalent bypasses for the route under test.
- Stop immediately if any unexpected request is attempted, fixture markers are missing, expected upstream call counts are zero or inconsistent, or the intended route did not execute. A 200 response alone does not prove the workload reached the code being profiled.

## 3. Measure request CPU separately from profiling

1. Use the same Node version, build mode, locale, environment, fixture, and serial request shape for every variant. Record `process.version`, commit SHA, route URL, response status, fixture cardinalities, and allowed/rejected mock counts.
2. Warm the server before collecting measurements. A practical starting point is 20 alternating warmups followed by 100 serial requests per variant in one process. If a variant cannot be switched per request, run the same sequence against each build in separate clean server processes and state that comparison limitation.
3. For each outer user-facing request, snapshot server-process CPU immediately before route dispatch and again when the complete outer response finishes. Sum user and system CPU for the interval. Keep nested internal API work inside that outer interval; do not reset or separately add a nested timer. With concurrency at one and no unrelated requests or scheduled jobs, record per-request CPU, response bytes, median, P95, mean, and paired deltas when the design allows pairing. Exclude fixture/setup work, logging, artifact writes, and profiler-control calls from the interval. Report wall time separately; it is not CPU time. If also measuring an API route called during SSR, keep that as a separate run and do not add its CPU to the page measurement.
4. Do not leave the measurement hook or harness in application code. Put one-off drivers and result files under `/tmp`, and keep the result reproducible from a written fixture description and command summary.

## 4. Capture V8 profiles

- Capture a separate profile after startup and warmup so startup work does not dominate the route samples. Attach to the local Node server through the V8 Inspector / Chrome DevTools Protocol `Profiler` domain, use a 1 ms sample interval, and profile a bounded batch of serial route requests. Around 60 requests per workload is a useful starting point; extend it when the profile has too few samples.
- Profile the API handler and the complete Nuxt page separately when needed. If the API's TypeScript helpers are not prominent but the page is expensive, inspect SSR rendering and payload serialization before proposing an optimization.
- Enable server source maps in the local build and verify that profile frames resolve to the intended TypeScript/Vue files before making source-level hotspot claims. If they remain bundled or unsymbolized, report that limitation and do not select a source-level fix from those frames.
- Save raw `.cpuprofile` files under `/tmp`, not in Git. Rank functions by sampled self time and inspect inclusive time to find expensive callees. Separate application frames from idle, GC, and runtime frames; disclose low sample counts.
- Keep profiled runs separate from latency/CPU comparison runs because sampling changes runtime overhead. A profile locates likely hotspots; it does not by itself establish a before/after CPU improvement.

## 5. Report evidence and decide whether to change code

In Plane, record the route and commit, Node version, fixture sizes, warmups and request counts, mock call counts, response status/bytes, CPU measurement method and distribution, V8 sample interval/count, top self/inclusive functions, profile artifact location, and limitations. State clearly when results are synthetic Node measurements.

Keep the top-cost table tied to observed frames and the route actually exercised. If the route is not proven to be the source of the sampled work, or a before/after CPU interval includes zero, say so and do not claim a CPU reduction. Make no speculative optimization; use the evidence to choose the next focused change or to conclude that the route was not the bottleneck.
