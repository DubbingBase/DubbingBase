import { appendFile, readFile, writeFile } from "node:fs/promises";

const [basePath, headPath, outputPath = "/tmp/route-cpu-comparison.md"] = process.argv.slice(2);
if (!basePath || !headPath) {
  throw new Error("Pass the base and pull request route CPU report paths.");
}

const baseReport = JSON.parse(await readFile(basePath, "utf8"));
const headReport = JSON.parse(await readFile(headPath, "utf8"));
if (baseReport.runtime !== headReport.runtime) {
  throw new Error("Base and pull request route CPU reports use different Node versions.");
}

const routeNames = ["home-movies", "home-shows", "movie", "show", "actor", "voice-actor"];
const datasets = ["representative", "large"];

function readWorkloads(report, side) {
  if (!Array.isArray(report.workloads)) {
    throw new Error(`${side} route CPU report has no workload list.`);
  }
  return new Map(
    report.workloads.map((workload) => [`${workload.name}:${workload.dataset}`, workload]),
  );
}

const baseWorkloads = readWorkloads(baseReport, "Base");
const headWorkloads = readWorkloads(headReport, "PR");

function formatCpu(stats) {
  const format = (micros) => (micros / 1000).toFixed(3);
  return `${format(stats.median)} ms (${format(stats.minimum)}–${format(stats.maximum)})`;
}

function formatDelta(micros) {
  const milliseconds = micros / 1000;
  return `${milliseconds >= 0 ? "+" : ""}${milliseconds.toFixed(3)} ms`;
}

function formatBytes(stats) {
  return `${stats.median.toFixed(0)} B (${stats.minimum.toFixed(0)}–${stats.maximum.toFixed(0)})`;
}

function safeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("`", "\\`");
}

function getWorkload(reportWorkloads, route, dataset, side) {
  const workload = reportWorkloads.get(`${route}:${dataset}`);
  if (!workload) {
    throw new Error(`${side} report is missing ${route} ${dataset} workload.`);
  }
  return workload;
}

function sameFixture(base, head, route, dataset) {
  if (base.path !== head.path || JSON.stringify(base.fixture) !== JSON.stringify(head.fixture)) {
    throw new Error(`Base and PR fixtures differ for ${route} ${dataset}.`);
  }
}

const rows = [];
for (const dataset of datasets) {
  for (const route of routeNames) {
    const base = getWorkload(baseWorkloads, route, dataset, "Base");
    const head = getWorkload(headWorkloads, route, dataset, "PR");
    sameFixture(base, head, route, dataset);
    const baseCpu = base.cpuMicrosPerRequest.total;
    const headCpu = head.cpuMicrosPerRequest.total;
    rows.push(
      `| ${route} (${dataset}) | ${formatCpu(baseCpu)} | ${formatCpu(headCpu)} | ${formatDelta(headCpu.median - baseCpu.median)} | ${formatBytes(base.responseBytesPerRequest)} → ${formatBytes(head.responseBytesPerRequest)} |`,
    );
  }
}

function formatFrames(workload) {
  const profile = workload.profile;
  const frames = profile?.topSampledFrames;
  if (!profile || !Array.isArray(frames)) {
    throw new Error(`Large workload ${workload.name} is missing its V8 profile summary.`);
  }
  if (frames.length === 0) return "No application frames sampled";
  return `${profile.relevantSampleCount}/${profile.sampleCount} app samples; ${frames
    .slice(0, 5)
    .map(
      (frame) =>
        `<code>${safeCell(frame.source)}</code> ${safeCell(frame.functionName)} (${frame.sampleSharePercent.toFixed(1)}%)`,
    )
    .join("; ")}`;
}

const frameRows = [];
for (const route of routeNames) {
  const base = getWorkload(baseWorkloads, route, "large", "Base");
  const head = getWorkload(headWorkloads, route, "large", "PR");
  frameRows.push(`| ${route} | ${formatFrames(base)} | ${formatFrames(head)} |`);
}

const markdown = [
  "## Local synthetic route CPU comparison",
  "",
  `Base <code>${process.env.BASE_SHA ?? "unknown"}</code> and PR merge revision <code>${process.env.HEAD_SHA ?? "unknown"}</code> ran sequentially on the same GitHub runner with Node ${baseReport.runtime}. Each route used deterministic mocked service data, 20 warmups, and five measured batches of 50 serial requests per fixture. CPU is process user + system around in-process H3 dispatch, including Request construction, mock-call bookkeeping, and response-body consumption. This is a comparative proxy, not server-only CPU. Values show median (observed batch min–max). The API handlers and H3 serialization are real; MediaService, TMDB, and database dependencies return pre-shaped fixtures, so their internal transforms aren't measured.`,
  "",
  "| Route | Base CPU/request | PR CPU/request | PR − base | Response bytes/request (base → PR) |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows,
  "",
  "### Large-fixture V8 profile samples",
  "",
  "Profiles were captured separately from CPU measurements with a 1 ms V8 sampling interval over 100 serial requests. The frame shares below are percentages of route/server and H3 samples only; they are sampled self-time approximations, not exact function timings. Raw `.cpuprofile` files are attached to this run's artifact.",
  "",
  "| Route | Base top sampled frames | PR top sampled frames |",
  "| --- | --- | --- |",
  ...frameRows,
  "",
  "These are synthetic local Node H3 handler measurements. They include in-process request creation, mocks, and response consumption, so they are comparative proxies rather than server-only CPU. They exclude provider network/client decoding, MediaService and database dependency internals, full Nuxt page SSR, and Cloudflare Workers runtime/accounting. Ranges are observed spread, not confidence intervals; small deltas are inconclusive.",
].join("\n");

await writeFile(outputPath, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(`Route CPU comparison written to ${outputPath}`);
