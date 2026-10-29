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

const routeNames = ["movie", "show", "actor", "voice-actor"];
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
      `| ${route} (${dataset}) | ${formatCpu(baseCpu)} | ${formatCpu(headCpu)} | ${formatDelta(headCpu.median - baseCpu.median)} | ${formatBytes(base.htmlBytesPerRequest)} → ${formatBytes(head.htmlBytesPerRequest)} |`,
    );
  }
}

function formatFrames(workload) {
  const profile = workload.profile;
  const sampledFrames = profile?.topSampledFrames;
  if (!profile || !Array.isArray(sampledFrames)) {
    throw new Error(`Large workload ${workload.name} is missing its V8 profile summary.`);
  }
  const frames = sampledFrames.filter((frame) => {
    const sourcePaths = [frame.source, frame.generatedSource]
      .filter((source) => typeof source === "string")
      .map((source) => source.replaceAll("\\", "/"));
    return !(
      frame.functionName === "flatten" &&
      sourcePaths.some((source) => source.includes("/devalue/"))
    );
  });
  if (frames.length === 0) {
    return "No other frames sampled after filtering identified devalue.flatten frames";
  }
  return `${profile.relevantSampleCount}/${profile.sampleCount} server samples; ${frames
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
  "## Local Nuxt SSR CPU comparison",
  "",
  `Base <code>${process.env.BASE_SHA ?? "unknown"}</code> and PR merge revision <code>${process.env.HEAD_SHA ?? "unknown"}</code> ran sequentially on the same GitHub runner with Node ${baseReport.runtime}. The benchmark requests the built Nuxt/Nitro Node server using deterministic TMDB, TVDB, and Supabase fixtures. It warms each route 10 times, then records five batches of 20 serial requests. Each CPU value comes from the server process between Nitro request handling and the Node response finish event; the HTTP driver runs in a separate process. Values show median (observed batch min–max).`,
  "",
  "| Route | Base CPU/request | PR CPU/request | PR − base | HTML bytes/request (base → PR) |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows,
  "",
  "### Large-fixture V8 profile samples",
  "",
  "Profiles were captured separately from CPU measurements with a 1 ms V8 sampling interval over 50 serial requests for each large fixture. The displayed hotspot list filters frames named `flatten` when either the mapped or generated source path identifies the `devalue` package; ambiguous frames without that path may remain. Per-request CPU and profile share percentages include all route work, including devalue. Other frame shares represent sampled server JavaScript self-time, including bundled framework code, and are approximations rather than exact timings. Locations map to source files when source maps are emitted and otherwise refer to generated server chunks. Raw `.cpuprofile` files are attached to this run's artifact.",
  "",
  "| Route | Base top sampled frames | PR top sampled frames |",
  "| --- | --- | --- |",
  ...frameRows,
  "",
  "These are synthetic local Node SSR measurements with real page and Nitro API code. Mocked upstream responses are parsed by the real provider and Supabase clients; real upstream latency, browser rendering, and Cloudflare Workers runtime/accounting are excluded. The results do not establish production CPU savings. Ranges are observed spread, not confidence intervals, so small deltas are inconclusive.",
].join("\n");

await writeFile(outputPath, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(`Route CPU comparison written to ${outputPath}`);
