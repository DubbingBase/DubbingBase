import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteDir = resolve(import.meta.dirname, "..");
const repoDir = resolve(websiteDir, "../..");
const metricPath = resolve(process.env.ROUTE_CPU_METRICS_PATH ?? "/tmp/route-cpu-metrics.jsonl");
const outputPath = resolve(process.env.ROUTE_CPU_OUTPUT ?? "/tmp/route-cpu.json");
const profileDir = resolve(process.env.ROUTE_CPU_PROFILE_DIR ?? dirname(outputPath));
const warmupRequests = 10;
const measuredRounds = 5;
const requestsPerRound = 20;
const profileRequests = 50;
const requireFromNuxt = createRequire(import.meta.resolve("nuxt"));
const { TraceMap, originalPositionFor } = requireFromNuxt("@jridgewell/trace-mapping");

const routes = [
  {
    name: "movie",
    path: "/movie/85",
    marker: "CI fixture movie 85",
    expected: ["tmdb:/3/movie/85", "supabase:dubbing_projects"],
  },
  {
    name: "show",
    path: "/show/1396",
    marker: "CI fixture show 1396",
    expected: ["tmdb:/3/tv/1396", "tmdb:/3/tv/1396/aggregate_credits", "supabase:dubbing_projects"],
  },
  {
    name: "actor",
    path: "/actor/6384",
    marker: "CI fixture actor",
    expected: ["tmdb:/3/person/6384", "supabase:work"],
  },
  {
    name: "voice-actor",
    path: "/voice-actor/1",
    marker: "CI fixture voice actor",
    expected: ["tmdb:/3/person/12001", "supabase:voice_actors"],
  },
];

const profilePlugin = `
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import inspector from "node:inspector";
import { join } from "node:path";
import { defineEventHandler, getQuery } from "h3";

const pageRoutes = new Set(${JSON.stringify(routes.map((route) => route.path))});

function post(session, method, params = {}) {
  return new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export default defineNitroPlugin(async (nitroApp) => {
  const metricsPath = process.env.ROUTE_CPU_METRICS_PATH;
  const profilesPath = process.env.ROUTE_CPU_PROFILE_DIR;
  const session = new inspector.Session();
  session.connect();
  const startedRequests = new WeakMap();
  let activeProfileName = null;

  nitroApp.hooks.hook("request", (event) => {
    if (!metricsPath || !pageRoutes.has(event.path.split("?")[0])) return;
    const requestId = event.node.req.headers["x-route-cpu-request-id"];
    if (typeof requestId !== "string") return;

    startedRequests.set(event, process.cpuUsage());
    event.node.res.once("finish", () => {
      const start = startedRequests.get(event);
      if (!start) return;
      const usage = process.cpuUsage(start);
      appendFileSync(
        metricsPath,
        JSON.stringify({ id: requestId, userMicros: usage.user, systemMicros: usage.system }) + "\\n",
      );
    });
  });

  nitroApp.router.use("/__route_cpu__/health", defineEventHandler(() => ({ ok: true })));
  nitroApp.router.use("/__route_cpu__/dependencies", defineEventHandler(() => {
    const requests = Reflect.get(globalThis, "__routeCpuUpstreamRequests");
    return requests instanceof Map ? Object.fromEntries(requests) : {};
  }));
  nitroApp.router.use("/__route_cpu__/dependencies/reset", defineEventHandler(() => {
    const requests = Reflect.get(globalThis, "__routeCpuUpstreamRequests");
    if (requests instanceof Map) requests.clear();
    return { ok: true };
  }));
  nitroApp.router.use("/__route_cpu__/profile/start", defineEventHandler(async (event) => {
    const name = getQuery(event).name;
    if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name) || activeProfileName) {
      throw new Error("Invalid or overlapping route CPU profile request.");
    }
    activeProfileName = name;
    await post(session, "Profiler.enable");
    await post(session, "Profiler.setSamplingInterval", { interval: 1000 });
    await post(session, "Profiler.start");
    return { ok: true };
  }));
  nitroApp.router.use("/__route_cpu__/profile/stop", defineEventHandler(async () => {
    if (!activeProfileName || !profilesPath) {
      throw new Error("No route CPU profile is active.");
    }
    const name = activeProfileName;
    activeProfileName = null;
    const result = await post(session, "Profiler.stop");
    await post(session, "Profiler.disable");
    mkdirSync(profilesPath, { recursive: true });
    const path = join(profilesPath, name + ".cpuprofile");
    writeFileSync(path, JSON.stringify(result.profile) + "\\n");
    return { samples: result.profile.samples.length };
  }));
});
`;

function scheduledTasksPatch(source) {
  const guard = 'process.env.E2E_TEST === "true"';
  if (source.split(guard).length !== 2) {
    throw new Error("Could not find the scheduled task guard in nuxt.config.ts.");
  }
  return source.replace(
    guard,
    '(process.env.E2E_TEST === "true" || process.env.ROUTE_CPU_BENCHMARK === "true")',
  );
}

function localBenchmarkEnvironment() {
  const environment = { ...process.env };
  delete environment.E2E_TEST;
  return environment;
}

async function assertIsolatedNetworkNamespace(action) {
  const hostNetworkNamespace = process.env.ROUTE_CPU_HOST_NETWORK_NAMESPACE;
  if (!hostNetworkNamespace) {
    throw new Error(`Capture the host network namespace before running ${action}.`);
  }
  if ((await readlink("/proc/self/ns/net")) === hostNetworkNamespace) {
    throw new Error(`Run ${action} inside the isolated network namespace.`);
  }
}

async function buildWebsite() {
  await assertIsolatedNetworkNamespace("the website build");

  const nuxtConfigPath = join(websiteDir, "nuxt.config.ts");
  const pluginPath = join(websiteDir, "server/plugins/route-cpu-profile.ts");
  const originalNuxtConfig = await readFile(nuxtConfigPath, "utf8");
  const tempDir = await mkdtemp(join(tmpdir(), "route-cpu-build-"));
  const configBackupPath = join(tempDir, "nuxt.config.ts");
  await copyFile(nuxtConfigPath, configBackupPath);
  try {
    await writeFile(nuxtConfigPath, scheduledTasksPatch(originalNuxtConfig));
    await writeFile(pluginPath, profilePlugin);
    await runCommand("mise", ["run", "check"], {
      cwd: repoDir,
      env: {
        ...localBenchmarkEnvironment(),
        NODE_ENV: "production",
        pnpm_config_minimum_release_age: "0",
        pnpm_config_minimum_release_age_strict: "false",
        ROUTE_CPU_BENCHMARK: "true",
        NITRO_PRESET: "node-server",
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "local-route-cpu-fixture",
        SUPABASE_SECRET_KEY: "local-route-cpu-fixture",
        TMDB_API_KEY: "local-route-cpu-fixture",
        TVDB_API_KEY: "local-route-cpu-fixture",
      },
    });
  } finally {
    await copyFile(configBackupPath, nuxtConfigPath);
    await rm(pluginPath, { force: true });
    await rm(tempDir, { recursive: true, force: true });
  }
}

let activeChild;
async function runCommand(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: "inherit" });
  activeChild = child;
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (exitCode, signal) => {
        if (signal) reject(new Error(`${command} stopped by ${signal}.`));
        else resolve(exitCode ?? 1);
      });
    });
  } finally {
    activeChild = undefined;
  }
  if (code !== 0) throw new Error(`${command} exited with code ${code}.`);
}

function metricsFromFile(content) {
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readMetrics() {
  try {
    return metricsFromFile(await readFile(metricPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && Reflect.get(error, "code") === "ENOENT") return [];
    throw error;
  }
}

function summarize(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const median =
    ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
  return { median, minimum: ordered[0], maximum: ordered.at(-1) };
}

async function cpuProfileSummary(profile) {
  const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
  const frames = new Map();
  const sourceMaps = new Map();
  let relevantSampleCount = 0;

  for (let index = 0; index < profile.samples.length; index += 1) {
    const node = nodesById.get(profile.samples[index]);
    const sampledMicros = profile.timeDeltas[index] ?? 0;
    if (!node || sampledMicros <= 0) continue;

    const frameUrl = node.callFrame.url;
    if (!frameUrl.includes("/.output/server/")) continue;
    relevantSampleCount += 1;
    const filePath = frameUrl.startsWith("file:") ? fileURLToPath(frameUrl) : frameUrl;
    const generatedSource = relative(websiteDir, filePath).replaceAll("\\", "/");
    const functionName = node.callFrame.functionName || "(anonymous)";
    const key = `${generatedSource}:${node.callFrame.lineNumber + 1}:${node.callFrame.columnNumber}:${functionName}`;
    const current = frames.get(key);
    frames.set(key, {
      functionName,
      filePath,
      generatedSource,
      line: node.callFrame.lineNumber + 1,
      column: node.callFrame.columnNumber,
      sampledMicros: (current?.sampledMicros ?? 0) + sampledMicros,
    });
  }

  const mappedFrames = await Promise.all(
    [...frames.values()].map(async (frame) => {
      let sourceMapPromise = sourceMaps.get(frame.filePath);
      if (!sourceMapPromise) {
        sourceMapPromise = readFile(`${frame.filePath}.map`, "utf8")
          .then((content) => new TraceMap(JSON.parse(content)))
          .catch(() => null);
        sourceMaps.set(frame.filePath, sourceMapPromise);
      }

      const sourceMap = await sourceMapPromise;
      const original = sourceMap
        ? originalPositionFor(sourceMap, { line: frame.line, column: frame.column })
        : null;
      const source =
        original?.source && original.line
          ? `${relative(websiteDir, resolve(dirname(frame.filePath), original.source)).replaceAll("\\", "/")}:${original.line}`
          : `${frame.generatedSource}:${frame.line}`;
      return { ...frame, source };
    }),
  );

  const totalSampledMicros = mappedFrames.reduce((total, frame) => total + frame.sampledMicros, 0);
  const applicationFrames = mappedFrames.filter((frame) => {
    const source = frame.source.replaceAll("\\", "/");
    return (
      source.startsWith("src/") ||
      source.startsWith("../../packages/") ||
      source.startsWith("packages/")
    );
  });
  const displayedFrames = mappedFrames.filter((frame) => {
    if (frame.functionName !== "flatten") return true;
    const sourcePaths = [frame.source, frame.generatedSource].map((source) =>
      source.replaceAll("\\", "/"),
    );
    return !sourcePaths.some((source) => source.includes("/devalue/"));
  });

  return {
    sampleCount: profile.samples.length,
    relevantSampleCount,
    topApplicationFrames: applicationFrames
      .sort((left, right) => right.sampledMicros - left.sampledMicros)
      .slice(0, 16)
      .map(({ functionName, source, sampledMicros }) => ({
        functionName,
        source,
        sampledMicros,
        sampleSharePercent:
          totalSampledMicros > 0 ? (sampledMicros / totalSampledMicros) * 100 : 0,
      })),
    topSampledFrames: displayedFrames
      .sort((left, right) => right.sampledMicros - left.sampledMicros)
      .slice(0, 16)
      .map(({ functionName, source, generatedSource, sampledMicros }) => ({
        functionName,
        source,
        generatedSource,
        sampledMicros,
        sampleSharePercent: totalSampledMicros > 0 ? (sampledMicros / totalSampledMicros) * 100 : 0,
      })),
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate local port.");
  const port = address.port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function startServer(dataset) {
  await rm(metricPath, { force: true });
  const port = await freePort();
  const serverPath = join(websiteDir, ".output/server/index.mjs");
  const preloadPath = join(websiteDir, "scripts/route-cpu-upstream.mjs");
  const server = spawn(process.execPath, ["--import", preloadPath, serverPath], {
    cwd: websiteDir,
    env: {
      ...localBenchmarkEnvironment(),
      NODE_ENV: "production",
      ROUTE_CPU_BENCHMARK: "true",
      ROUTE_CPU_DATASET: dataset,
      ROUTE_CPU_METRICS_PATH: metricPath,
      ROUTE_CPU_PROFILE_DIR: profileDir,
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "local-route-cpu-fixture",
      SUPABASE_SECRET_KEY: "local-route-cpu-fixture",
      TMDB_API_KEY: "local-route-cpu-fixture",
      TVDB_API_KEY: "local-route-cpu-fixture",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(port),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  activeChild = server;
  server.once("exit", () => {
    if (activeChild === server) activeChild = undefined;
  });

  const stderrLines = [];
  server.stderr.setEncoding("utf8");
  server.stderr.on("data", (chunk) => {
    stderrLines.push(...chunk.split("\n").filter(Boolean));
    if (stderrLines.length > 30) stderrLines.splice(0, stderrLines.length - 30);
  });
  server.once("error", (error) => stderrLines.push(String(error)));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Local Nitro server exited early:\n${stderrLines.join("\n")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/__route_cpu__/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        return {
          baseUrl,
          async stop() {
            if (server.exitCode !== null) return;
            server.kill("SIGTERM");
            await new Promise((resolve) => server.once("exit", resolve));
            if (activeChild === server) activeChild = undefined;
          },
          stderrLines,
        };
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  server.kill("SIGTERM");
  if (server.exitCode === null) {
    await new Promise((resolve) => server.once("exit", resolve));
  }
  throw new Error(`Local Nitro server did not start:\n${stderrLines.join("\n")}`);
}

async function postJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST" });
  if (!response.ok)
    throw new Error(`Local profiler endpoint ${path} returned HTTP ${response.status}.`);
  return response.json();
}

async function requestPage(baseUrl, route) {
  const id = randomUUID();
  const response = await fetch(`${baseUrl}${route.path}`, {
    headers: {
      "accept-language": "fr-FR",
      "x-route-cpu-request-id": id,
    },
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.arrayBuffer();
  if (!response.ok) {
    const excerpt = Buffer.from(body).toString("utf8").slice(0, 800);
    throw new Error(`${route.path} returned HTTP ${response.status}: ${excerpt}`);
  }
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(
      `${route.path} returned ${response.headers.get("content-type")}, not SSR HTML.`,
    );
  }
  return { id, bytes: body.byteLength, html: Buffer.from(body).toString("utf8") };
}

async function readRequestMetrics(ids) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = new Map((await readMetrics()).map((row) => [row.id, row]));
    if (ids.every((id) => rows.has(id))) return rows;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The Nitro server did not finish recording the page request CPU metrics.");
}

async function requestBatch(baseUrl, route, count) {
  const ids = [];
  let responseBytes = 0;
  for (let index = 0; index < count; index += 1) {
    const response = await requestPage(baseUrl, route);
    ids.push(response.id);
    responseBytes += response.bytes;
  }

  const rows = await readRequestMetrics(ids);
  const samples = ids.map((id) => {
    const row = rows.get(id);
    if (!row)
      throw new Error(`The Nitro server did not record CPU for ${route.path} request ${id}.`);
    return row;
  });
  return {
    userMicrosPerRequest: samples.reduce((total, row) => total + row.userMicros, 0) / count,
    systemMicrosPerRequest: samples.reduce((total, row) => total + row.systemMicros, 0) / count,
    totalMicrosPerRequest:
      samples.reduce((total, row) => total + row.userMicros + row.systemMicros, 0) / count,
    htmlBytesPerRequest: responseBytes / count,
  };
}

async function currentDependencies(baseUrl) {
  const response = await fetch(`${baseUrl}/__route_cpu__/dependencies`);
  if (!response.ok) throw new Error("Could not read local mock dependency counters.");
  return response.json();
}

function assertRouteDependencies(route, before, after) {
  for (const key of route.expected) {
    if ((after[key] ?? 0) <= (before[key] ?? 0)) {
      throw new Error(`${route.path} did not reach its real upstream dependency ${key}.`);
    }
  }
}

async function measureDataset(dataset) {
  const server = await startServer(dataset);
  const workloads = [];
  try {
    for (const route of routes) {
      const before = await currentDependencies(server.baseUrl);
      const validation = await requestPage(server.baseUrl, route);
      if (!validation.html.includes(route.marker) || !validation.html.includes("__NUXT_DATA__")) {
        throw new Error(`${route.path} did not SSR the expected fixture data.`);
      }
      const after = await currentDependencies(server.baseUrl);
      assertRouteDependencies(route, before, after);

      await postJson(server.baseUrl, "/__route_cpu__/dependencies/reset");
      for (let index = 0; index < warmupRequests; index += 1) {
        await requestPage(server.baseUrl, route);
      }

      const rounds = [];
      for (let round = 0; round < measuredRounds; round += 1) {
        rounds.push(await requestBatch(server.baseUrl, route, requestsPerRound));
      }

      let profile;
      if (dataset === "large") {
        await postJson(server.baseUrl, `/__route_cpu__/profile/start?name=${route.name}`);
        for (let index = 0; index < profileRequests; index += 1) {
          await requestPage(server.baseUrl, route);
        }
        const profileResult = await postJson(server.baseUrl, "/__route_cpu__/profile/stop");
        const profilePath = join(profileDir, `${route.name}.cpuprofile`);
        const rawProfile = JSON.parse(await readFile(profilePath, "utf8"));
        profile = await cpuProfileSummary(rawProfile);
        if (profile.relevantSampleCount === 0 || profileResult.samples === 0) {
          throw new Error(`V8 did not sample server frames for ${route.path}.`);
        }
      }

      const dependencies = await currentDependencies(server.baseUrl);
      workloads.push({
        name: route.name,
        path: route.path,
        dataset,
        fixture: {
          mediaCredits: dataset === "large" ? 1200 : 180,
          dubbingProjects: dataset === "large" ? 500 : 40,
          actorCredits: dataset === "large" ? 1200 : 640,
          actorRoles: dataset === "large" ? 500 : 24,
          voiceActorWorks: dataset === "large" ? 500 : 24,
          uniqueVoiceActorMedia: dataset === "large" ? 100 : 12,
        },
        warmupRequests,
        measuredRounds,
        requestsPerRound,
        profileRequests: dataset === "large" ? profileRequests : 0,
        cpuMicrosPerRequest: {
          user: summarize(rounds.map((round) => round.userMicrosPerRequest)),
          system: summarize(rounds.map((round) => round.systemMicrosPerRequest)),
          total: summarize(rounds.map((round) => round.totalMicrosPerRequest)),
        },
        htmlBytesPerRequest: summarize(rounds.map((round) => round.htmlBytesPerRequest)),
        upstreamRequests: dependencies,
        profile,
      });
    }
  } catch (error) {
    if (server.stderrLines.length > 0) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nNitro stderr:\n${server.stderrLines.join("\n")}`,
      );
    }
    throw error;
  } finally {
    await server.stop();
  }
  return workloads;
}

async function measure() {
  await assertIsolatedNetworkNamespace("route profiling");

  await rm(profileDir, { recursive: true, force: true });
  await mkdir(profileDir, { recursive: true });
  const workloads = [];
  for (const dataset of ["representative", "large"]) {
    workloads.push(...(await measureDataset(dataset)));
  }

  const report = {
    runtime: process.version,
    method:
      "Full page SSR through the built Nuxt/Nitro Node server. The server process records process.cpuUsage from Nitro request handling through the Node response finish event; the HTTP driver is separate. TMDB, TVDB, and Supabase HTTP responses are deterministic in-memory fixtures, and the server runs in a network namespace with loopback only.",
    scope:
      "Measures real page and API route code, provider response parsing/transforms, Supabase query handling, SSR data preparation, HTML generation, and response writing. It excludes browser rendering, real upstream latency/client infrastructure, Cloudflare Workers runtime/accounting, and production traffic. V8 profiles are sampled self-time approximations; source map locations are used when available, with generated chunk locations as fallback.",
    warmupRequests,
    measuredRounds,
    requestsPerRound,
    workloads,
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Local Nuxt SSR route CPU report written to ${outputPath}`);
}

process.on("SIGTERM", () => activeChild?.kill("SIGTERM"));
process.on("SIGINT", () => activeChild?.kill("SIGINT"));

const action = process.argv[2];
if (action === "build") {
  await buildWebsite();
} else if (action === "measure") {
  await measure();
} else {
  throw new Error("Usage: node scripts/route-cpu-ssr.mjs <build|measure>");
}
