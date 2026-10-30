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
if (
  !Number.isSafeInteger(baseReport.measuredRounds) ||
  baseReport.measuredRounds < 1 ||
  baseReport.measuredRounds !== headReport.measuredRounds ||
  baseReport.warmupRequests !== headReport.warmupRequests ||
  baseReport.requestsPerRound !== headReport.requestsPerRound
) {
  throw new Error("Base and pull request reports use different or invalid paired workloads.");
}

const routeNames = ["movie", "show", "actor", "voice-actor", "season"];
const datasets = ["representative", "large"];
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
  return `${(stats.median / 1000).toFixed(1)} ms`;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(sortedValues, probability) {
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

function bootstrapMedianInterval(values, seedText) {
  let state = 2166136261;
  for (const character of seedText) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const estimates = [];
  for (let iteration = 0; iteration < 5000; iteration += 1) {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(random() * values.length)],
    );
    estimates.push(median(sample));
  }
  estimates.sort((left, right) => left - right);
  return { lower: percentile(estimates, 0.025), upper: percentile(estimates, 0.975) };
}

function formatDelta(baseMedianMicros, pairedDeltasMicros, intervalMicros) {
  const deltaMicros = median(pairedDeltasMicros);
  const milliseconds = deltaMicros / 1000;
  const percentage = (deltaMicros / baseMedianMicros) * 100;
  const lower = intervalMicros.lower / 1000;
  const upper = intervalMicros.upper / 1000;
  const marker = milliseconds > 0 ? "🔴" : milliseconds < 0 ? "🟢" : "⚪";
  const formatSigned = (value, decimals) => {
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${Math.abs(value).toFixed(decimals)}`;
  };
  return `${marker} ${formatSigned(milliseconds, 2)} ms (${formatSigned(percentage, 1)}%; ${formatSigned(lower, 2)} to ${formatSigned(upper, 2)} ms)`;
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
    const baseDeltas = base.pairedCpuDeltaSamplesMicrosPerRequest;
    const headDeltas = head.pairedCpuDeltaSamplesMicrosPerRequest;
    if (
      !Array.isArray(baseDeltas) ||
      !Array.isArray(headDeltas) ||
      baseDeltas.length !== baseReport.measuredRounds ||
      baseDeltas.some((delta) => !Number.isFinite(delta)) ||
      JSON.stringify(baseDeltas) !== JSON.stringify(headDeltas)
    ) {
      throw new Error(`Base and PR reports have invalid paired samples for ${route} ${dataset}.`);
    }
    if (
      !Number.isFinite(baseCpu.median) ||
      baseCpu.median <= 0 ||
      !Number.isFinite(headCpu.median)
    ) {
      throw new Error(`Base and PR reports have invalid CPU medians for ${route} ${dataset}.`);
    }
    const interval = bootstrapMedianInterval(headDeltas, `${route}:${dataset}`);
    cpuComparisons.push({ interval });
    rows.push(
      `| ${route} (${dataset}) | ${formatCpu(baseCpu)} | ${formatCpu(headCpu)} | ${formatDelta(baseCpu.median, headDeltas, interval)} |`,
    );
  }
}
const intervalsContainingZero = cpuComparisons.filter(
  ({ interval }) => interval.lower <= 0 && interval.upper >= 0,
).length;
const resultSummary =
  intervalsContainingZero === cpuComparisons.length
    ? `All ${cpuComparisons.length} paired 95% intervals include zero; this run shows no clear CPU change.`
    : `${cpuComparisons.length - intervalsContainingZero} of ${cpuComparisons.length} paired 95% intervals exclude zero.`;
function isApplicationSource(source) {
  const normalized = source.replaceAll("\\", "/");
  return (
    normalized.startsWith("src/") ||
    normalized.startsWith("../../packages/") ||
    normalized.startsWith("packages/")
  );
}

function formatTopApplicationCpuConsumers(workload, route, revision) {
  const profile = workload.profile;
  const hasFullApplicationFrames = Array.isArray(profile?.topApplicationFrames);
  const sampledFrames =
    profile?.topApplicationFrames ??
    profile?.topSampledFrames?.filter((frame) =>
      isApplicationSource(frame.source),
    );
  if (!profile || !Array.isArray(sampledFrames)) {
    throw new Error(`Large workload ${workload.name} is missing its V8 profile summary.`);
  }
  if (sampledFrames.length === 0) {
    const reason = hasFullApplicationFrames
      ? "No application-code frame sampled"
      : "No application-code frame in top 16 sampled frames";
    return [`| ${route} | ${revision} | — | — | ${reason} | — |`];
  }
  return sampledFrames
    .slice(0, 10)
    .map((frame, index) =>
      `| ${route} | ${revision} | ${index + 1} | \`${safeCell(frame.functionName)}\` | \`${safeCell(frame.source)}\` | ${frame.sampleSharePercent.toFixed(1)}% |`,
    );
}

const frameRows = [];
for (const route of routeNames) {
  const base = getWorkload(baseWorkloads, route, "large", "Base");
  const head = getWorkload(headWorkloads, route, "large", "PR");
  frameRows.push(...formatTopApplicationCpuConsumers(base, route, "Base"));
  frameRows.push(...formatTopApplicationCpuConsumers(head, route, "PR"));
}

const markdown = [
  "## Local route CPU comparison",
  "",
  `Built Nuxt SSR · Node ${baseReport.runtime} · same runner · ${workflowRun}`,
  "",
  "20 warmups; 20 alternating paired batches of 20 requests per route. Change is the median paired PR − base delta; interval is a deterministic 95% bootstrap.",
  "",
  `**Result:** ${resultSummary} 🔴 more CPU · 🟢 less CPU · ⚪ unchanged median; markers show direction only. This PR changes CI benchmarking, not route code.`,
  "",
  "| Route / workload | Base median CPU / request | PR median CPU / request | Paired change (95% bootstrap interval) |",
  "| --- | ---: | ---: | ---: |",
  ...rows,
  "",
  "### Top 10 app CPU consumers (large workload)",
  "",
  "Top 10 unique app-owned functions, grouped by V8 function name and source-mapped function location. Shares are of sampled generated-server JavaScript time. `devalue.flatten` is excluded from this list but remains in CPU totals. Full profiles are in the artifact.",
  "",
  "<details>",
  "<summary>Show function names, source locations, and shares</summary>",
  "",
  "| Route | Revision | Rank | Function | Source location | Sample share |",
  "| --- | --- | ---: | --- | --- | ---: |",
  ...frameRows,
  "",
  "</details>",
].join("\n");

await writeFile(outputPath, `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(`Route CPU comparison written to ${outputPath}`);
