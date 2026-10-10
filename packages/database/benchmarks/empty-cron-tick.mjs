import { execFileSync } from "node:child_process";

const databaseDirectory = new URL("../", import.meta.url);
const statusOutput = execFileSync("pnpm", ["supabase", "status", "-o", "env"], {
  cwd: databaseDirectory,
  encoding: "utf8",
});
const environment = Object.fromEntries(
  [...statusOutput.matchAll(/^([A-Z_]+)="([^"]+)"$/gm)].map((match) => [match[1], match[2]]),
);
const apiUrl = environment.API_URL;
const serviceKey = environment.SERVICE_ROLE_KEY;
if (!apiUrl || !serviceKey || !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
  throw new Error("Benchmark requires a running local Supabase backend.");
}

async function rpc(name, args) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  if (!response.ok)
    throw new Error(`Local benchmark RPC ${name} failed (${response.status}): ${body}`);
  return body ? JSON.parse(body) : null;
}

const readyBeforeBenchmark = await rpc("get_ready_media_queues", {});
if (!Array.isArray(readyBeforeBenchmark) || readyBeforeBenchmark.length !== 0) {
  throw new Error("Benchmark requires all local media queues to be empty and visible.");
}

const repetitions = Number(process.env.BENCH_REPETITIONS ?? 11);
const beforeDurations = [];
const afterDurations = [];
const beforeCpuMicros = [];
const afterCpuMicros = [];

async function measure(operation, durations, cpuValues) {
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  await operation();
  durations.push(performance.now() - start);
  const cpuDelta = process.cpuUsage(cpuStart);
  cpuValues.push(cpuDelta.user + cpuDelta.system);
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

for (let index = 0; index < repetitions; index += 1) {
  await measure(
    async () => {
      await rpc("pop_media_queue_batch", {
        p_queue_name: "wiki_discovery",
        p_vt_seconds: 180,
        p_batch_size: 3,
      });
      await rpc("pop_media_queue_batch", {
        p_queue_name: "wiki_check",
        p_vt_seconds: 180,
        p_batch_size: 3,
      });
      await rpc("pop_media_queue_message", {
        p_queue_name: "wiki_extract",
        p_vt_seconds: 90,
      });
    },
    beforeDurations,
    beforeCpuMicros,
  );

  await measure(
    async () => {
      const ready = await rpc("get_ready_media_queues", {});
      if (!Array.isArray(ready) || ready.length !== 0) {
        throw new Error("A queue became non-empty during the idle benchmark.");
      }
    },
    afterDurations,
    afterCpuMicros,
  );
}

console.log(
  JSON.stringify({
    environment: "local Supabase only; empty queues",
    repetitions,
    priorDatabaseRpcsPerTick: 3,
    readinessDatabaseRpcsPerTick: 1,
    priorMedianDurationMs: median(beforeDurations),
    readinessMedianDurationMs: median(afterDurations),
    priorMedianHarnessCpuMs: median(beforeCpuMicros) / 1000,
    readinessMedianHarnessCpuMs: median(afterCpuMicros) / 1000,
  }),
);
