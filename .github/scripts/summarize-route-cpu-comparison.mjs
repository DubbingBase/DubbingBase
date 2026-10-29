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
const formatInteger = new Intl.NumberFormat("en-US");
const workflowRun =
  process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `[workflow run ${process.env.GITHUB_RUN_ID}](${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`
    : "workflow run unavailable";

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
  const format = (micros) => (micros / 1000).toFixed(1);
  return `${format(stats.median)} ms (${format(stats.minimum)}–${format(stats.maximum)})`;
}

function formatDelta(baseMicros, headMicros) {
  const milliseconds = (headMicros - baseMicros) / 1000;
  const percentage = ((headMicros - baseMicros) / baseMicros) * 100;
  const formatSigned = (value, decimals) => {
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${Math.abs(value).toFixed(decimals)}`;
  };
  return `${formatSigned(milliseconds, 2)} ms (${formatSigned(percentage, 1)}%)`;
}

function formatBytes(base, head) {
  const baseBytes = formatInteger.format(Math.round(base.median));
  const headBytes = formatInteger.format(Math.round(head.median));
  const same =
    base.median === head.median &&
    base.minimum === head.minimum &&
    base.maximum === head.maximum;
  return same ? `${baseBytes} B (same)` : `${baseBytes} B → ${headBytes} B`;
}

function formatFixture(route, fixture) {
  const format = (value) => formatInteger.format(value);
  if (route === "movie") {
    return `${format(fixture.mediaCredits)} cast credits + ${format(fixture.dubbingProjects)} dubbing projects`;
  }
  if (route === "show") {
    return `${format(fixture.mediaCredits)} aggregate credits + ${format(fixture.dubbingProjects)} dubbing projects`;
  }
  if (route === "actor") {
    return `${format(fixture.actorCredits)} TMDB credits + ${format(fixture.actorRoles)} voice roles`;
  }
  return `${format(fixture.voiceActorWorks)} works across ${format(fixture.uniqueVoiceActorMedia)} media titles`;
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
const cpuComparisons = [];
for (const route of routeNames) {
  for (const dataset of datasets) {
    const base = getWorkload(baseWorkloads, route, dataset, "Base");
    const head = getWorkload(headWorkloads, route, dataset, "PR");
    sameFixture(base, head, route, dataset);
    const baseCpu = base.cpuMicrosPerRequest.total;
    const headCpu = head.cpuMicrosPerRequest.total;
    const fixture = formatFixture(route, head.fixture);
    cpuComparisons.push({ base: baseCpu, head: headCpu });
    rows.push(
      `| ${route} (${dataset}) | ${fixture} | ${formatCpu(baseCpu)} | ${formatCpu(headCpu)} | ${formatDelta(baseCpu.median, headCpu.median)} | ${formatBytes(base.htmlBytesPerRequest, head.htmlBytesPerRequest)} |`,
    );
  }
}
const overlappingRanges = cpuComparisons.filter(
  ({ base, head }) => base.minimum <= head.maximum && head.minimum <= base.maximum,
).length;
const rangeSummary =
  overlappingRanges === cpuComparisons.length
    ? `The observed ranges overlap in all ${cpuComparisons.length} comparisons, so this run shows no clear CPU change.`
    : `The observed ranges overlap in ${overlappingRanges} of ${cpuComparisons.length} comparisons; min–max ranges are descriptive, not statistical confidence intervals.`;

function frameArea(workload, frame) {
  const source = frame.source.replaceAll("\\", "/");
  if (source.includes("/@vue/runtime-core/")) return "Vue";
  if (source.includes("/@vue/server-renderer/")) return "Vue SSR";
  if (source.includes("/@vue/reactivity/")) return "Vue reactivity";
  if (source.includes("/vue-router/")) return "Vue Router";
  if (source.includes("/@supabase/")) return "Supabase";
  if (source.includes("/devalue/")) return "devalue";
  if (source.includes("src/pages/")) return `${workload.name} page`;
  if (source.includes("/chunks/nitro/")) return "Nitro";
  return source.split("/").at(-1)?.split(":")[0] ?? "server";
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
  return `${formatInteger.format(profile.relevantSampleCount)} server samples: ${frames
    .slice(0, 3)
    .map(
      (frame) => `${frameArea(workload, frame)} ${safeCell(frame.functionName)} ${frame.sampleSharePercent.toFixed(1)}%`,
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
  `Base <code>${process.env.BASE_SHA ?? "unknown"}</code> and PR merge revision <code>${process.env.HEAD_SHA ?? "unknown"}</code> ran one after the other on the same GitHub runner with Node ${baseReport.runtime} (${workflowRun}). The benchmark used deterministic mock data and exercised the built Nuxt/Nitro server. This PR changes the benchmark workflow, not the website routes, so these numbers check that the comparison works; they do not show an application performance improvement.`,
  "",
  "**How to read this:** CPU/request is server user+system CPU for one complete server-rendered page response; lower is less CPU. The change is PR minus base, so `+` means the PR used more and `−` means it used less. Each value is the median of five batches of 20 serial requests after 10 warmups; the range is the observed batch min–max, not a confidence interval.",
  "",
  `**Takeaway:** ${rangeSummary}`,
  "",
  "| Route / workload | Mocked data size | Base CPU/request | PR CPU/request | Change (PR − base) | HTML bytes/request (base → PR) |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...rows,
  "",
  "### What the V8 profiles sampled",
  "",
  "Separate profiles used a 1 ms V8 sampling interval over 50 large-workload requests. Percentages below are approximate shares of sampled server JavaScript time, not milliseconds. Identified `devalue.flatten` frames are hidden from this list only; their CPU remains in the full-request measurements. Raw profiles are attached to this run's artifact.",
  "",
  "| Route | Base: most sampled functions | PR: most sampled functions |",
  "| --- | --- | --- |",
  ...frameRows,
  "",
  "Vue/Vue SSR names refer to page rendering; devalue refers to Nuxt payload serialization; Nitro and Vue Router refer to request handling. Fixture sizes are synthetic input counts, not production traffic distributions. Mocked upstream responses still pass through the real page and Nitro code; network wait, browser rendering, and Cloudflare Worker accounting are excluded. CPU changes this small should be treated as inconclusive, especially because the route code is unchanged.",
].join("\n");

await writeFile(outputPath, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(`Route CPU comparison written to ${outputPath}`);
