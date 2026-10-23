import readline from "node:readline";

// Pipe wrangler tail --format=json --search=route_cpu_sample into this file.
// Only sanitized route aggregates are written; raw tail events are discarded.
const WINDOW_MS = 15 * 60 * 1000;
const STARTED_AT = Date.now();
const ROUTE_FAMILIES = new Set([
  "page:home",
  "page:movie",
  "page:show",
  "page:actor",
  "page:voice-actor",
  "page:game",
  "page:podcast",
  "page:audiobook",
  "page:advertisement",
  "page:toy",
  "page:search",
  "page:other",
  "asset:nuxt",
  "api:movie",
  "api:show",
  "api:actor",
  "api:voice-actor",
  "api:game",
  "api:podcast",
  "api:audiobook",
  "api:advertisement",
  "api:toy",
  "api:search",
  "api:trending",
  "api:admin",
  "api:career-grid",
  "api:detail-collections",
  "api:episode",
  "api:season",
  "api:other",
]);

const buckets = new Map();
let matchedSamplesWithoutCpu = 0;

function percentile(values, percentile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

function logMessage(log) {
  const message = log?.message;
  if (Array.isArray(message)) return message.map(String).join(" ");
  return typeof message === "string" ? message : "";
}

function samplePayload(entry) {
  const logs = Array.isArray(entry.logs) ? entry.logs : [];
  for (const log of logs) {
    const message = logMessage(log);
    const marker = "route_cpu_sample:";
    const markerIndex = message.indexOf(marker);
    if (markerIndex < 0) continue;

    try {
      const start = markerIndex + marker.length;
      const payload = JSON.parse(message.slice(start).trim());
      if (
        payload.event !== "route_cpu_sample" ||
        !ROUTE_FAMILIES.has(payload.routeFamily) ||
        (payload.method !== "GET" && payload.method !== "OTHER")
      ) {
        continue;
      }
      return payload;
    } catch {
      continue;
    }
  }
  return null;
}

function invocationCpuMs(entry) {
  const value =
    entry.cpuTime ?? entry.cpuTimeMs ?? entry.CPUTimeMs ?? entry.cpu_time_ms;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function invocationWallMs(entry) {
  const value = entry.wallTime ?? entry.wallTimeMs ?? entry.WallTimeMs;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function invocationVersion(entry) {
  const version = entry.scriptVersion ?? entry.ScriptVersion;
  if (typeof version === "string") return version;
  if (version && typeof version === "object") {
    const value = version.id ?? version.versionId ?? version.version_id;
    if (typeof value === "string") return value;
  }
  return "unknown";
}

function addInvocation(entry) {
  const payload = samplePayload(entry);
  if (!payload) return;

  const cpuMs = invocationCpuMs(entry);
  const timestamp = Number(
    entry.eventTimestamp ?? entry.eventTimestampMs ?? entry.EventTimestampMs,
  );

  if (cpuMs === null || !Number.isFinite(timestamp)) {
    matchedSamplesWithoutCpu += 1;
    return;
  }

  const windowStart = Math.floor(timestamp / WINDOW_MS) * WINDOW_MS;
  const version = invocationVersion(entry);
  const key = `${windowStart}|${version}|${payload.routeFamily}|${payload.method}`;
  const bucket = buckets.get(key) ?? {
    windowStart,
    version,
    routeFamily: payload.routeFamily,
    method: payload.method,
    cpuMs: [],
    wallMs: [],
    statuses: {},
  };

  bucket.cpuMs.push(cpuMs);
  const wallMs = invocationWallMs(entry);
  if (wallMs !== null) bucket.wallMs.push(wallMs);
  const status = entry.event?.response?.status ?? entry.response?.status;
  if (Number.isInteger(status))
    bucket.statuses[status] = (bucket.statuses[status] ?? 0) + 1;
  buckets.set(key, bucket);
}

function emitBucket(bucket, now, forcePartial = false) {
  const windowEnd = bucket.windowStart + WINDOW_MS;
  const complete =
    !forcePartial && STARTED_AT <= bucket.windowStart && now >= windowEnd;
  const values = bucket.cpuMs;
  const mean =
    values.reduce((total, value) => total + value, 0) / values.length;
  process.stdout.write(
    `${JSON.stringify({
      windowStart: new Date(bucket.windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      complete,
      version: bucket.version,
      routeFamily: bucket.routeFamily,
      method: bucket.method,
      samples: values.length,
      cpuMeanMs: Number(mean.toFixed(3)),
      cpuP50Ms: percentile(values, 0.5),
      cpuP95Ms: percentile(values, 0.95),
      cpuP99Ms: percentile(values, 0.99),
      wallP95Ms: percentile(bucket.wallMs, 0.95),
      statusCounts: bucket.statuses,
    })}\n`,
  );
}

function flushBuckets(now, forcePartial = false) {
  for (const [key, bucket] of buckets) {
    const windowEnd = bucket.windowStart + WINDOW_MS;
    if (forcePartial || windowEnd <= now) {
      emitBucket(bucket, now, forcePartial);
      buckets.delete(key);
    }
  }
}

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
lines.on("line", (line) => {
  try {
    addInvocation(JSON.parse(line));
  } catch {
    // Wrangler may emit non-JSON status lines; ignore them without echoing input.
  }
});

const flushTimer = setInterval(() => flushBuckets(Date.now()), 5000);
lines.on("close", () => {
  clearInterval(flushTimer);
  flushBuckets(Date.now(), true);
  if (matchedSamplesWithoutCpu > 0) {
    process.stdout.write(
      `${JSON.stringify({ warning: "Some matching tail events lacked a numeric CPU time.", count: matchedSamplesWithoutCpu })}\n`,
    );
  }
});
