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
  return `${format(stats.median)} (${format(stats.minimum)}–${format(stats.maximum)}) ms`;
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
  return same ? `${baseBytes} B` : `${baseBytes} → ${headBytes} B`;
}

function formatFixture(route, fixture) {
  const format = (value) => formatInteger.format(value);
  if (route === "movie") {
    return `${format(fixture.mediaCredits)} cast credits, ${format(fixture.dubbingProjects)} projects`;
  }
  if (route === "show") {
    return `${format(fixture.mediaCredits)} cast/episode credits, ${format(fixture.dubbingProjects)} projects`;
  }
  if (route === "actor") {
    return `${format(fixture.actorCredits)} credits, ${format(fixture.actorRoles)} voice roles`;
  }
  return `${format(fixture.voiceActorWorks)} works / ${format(fixture.uniqueVoiceActorMedia)} titles`;
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
let unchangedHtmlComparisons = 0;
for (const route of routeNames) {
  for (const dataset of datasets) {
    const base = getWorkload(baseWorkloads, route, dataset, "Base");
    const head = getWorkload(headWorkloads, route, dataset, "PR");
    sameFixture(base, head, route, dataset);
    const baseCpu = base.cpuMicrosPerRequest.total;
    const headCpu = head.cpuMicrosPerRequest.total;
    const fixture = formatFixture(route, head.fixture);
    cpuComparisons.push({ base: baseCpu, head: headCpu });
    if (
      base.htmlBytesPerRequest.median === head.htmlBytesPerRequest.median &&
      base.htmlBytesPerRequest.minimum === head.htmlBytesPerRequest.minimum &&
      base.htmlBytesPerRequest.maximum === head.htmlBytesPerRequest.maximum
    ) {
      unchangedHtmlComparisons += 1;
    }
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
const htmlSummary =
  unchangedHtmlComparisons === cpuComparisons.length
    ? `HTML size is unchanged in all ${unchangedHtmlComparisons} comparisons.`
    : `HTML size changed in ${cpuComparisons.length - unchangedHtmlComparisons} of ${cpuComparisons.length} comparisons.`;

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
  return frames
    .slice(0, 2)
    .map(
      (frame) => `${safeCell(frame.functionName)} (${frameArea(workload, frame)}, ${frame.sampleSharePercent.toFixed(1)}%)`,
    )
    .join("; ");
}

const frameRows = [];
for (const route of routeNames) {
  const base = getWorkload(baseWorkloads, route, "large", "Base");
  const head = getWorkload(headWorkloads, route, "large", "PR");
  frameRows.push(`| ${route} | ${formatFrames(base)} | ${formatFrames(head)} |`);
}

const markdown = [
  "## Local route CPU comparison",
  "",
  `Built Nuxt SSR · Node ${baseReport.runtime} · same runner · ${workflowRun}`,
  "",
  "CPU/request = server user + system time; values are median (observed min–max) over 5 × 20 requests after 10 warmups. Change = PR − base.",
  "",
  `**Result:** ${rangeSummary} ${htmlSummary} This PR changes CI benchmarking, not route code.`,
  "",
  "| Route / workload | Mock data | Base CPU / request | PR CPU / request | Change | HTML / response (base → PR) |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...rows,
  "",
  "### Largest sampled JS hotspots (large workload)",
  "",
  "Top two sampled functions (% share) from 50 requests; `devalue.flatten` is omitted here but included in CPU totals. Full profiles are in the artifact.",
  "",
  "| Route | Base | PR |",
  "| --- | --- | --- |",
  ...frameRows,
].join("\n");

await writeFile(outputPath, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(`Route CPU comparison written to ${outputPath}`);
