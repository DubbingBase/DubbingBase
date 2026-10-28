import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [baseDirectory, headDirectory] = process.argv.slice(2);
if (!baseDirectory || !headDirectory) {
  throw new Error(
    "Pass the base and pull request Lighthouse report directories.",
  );
}

const routeNames = new Map([
  ["/", "home"],
  ["/movie/85", "movie"],
  ["/show/1396", "show"],
  ["/actor/3", "actor"],
  ["/voice-actor/1", "voice_actor"],
]);
const metricDefinitions = [
  { name: "Performance", category: "performance", unit: "%", decimals: 1 },
  { name: "LCP", audit: "largest-contentful-paint", unit: "ms", decimals: 1 },
  { name: "TBT", audit: "total-blocking-time", unit: "ms", decimals: 1 },
  { name: "CLS", audit: "cumulative-layout-shift", unit: "score", decimals: 4 },
  { name: "Speed Index", audit: "speed-index", unit: "ms", decimals: 1 },
];

const lighthouseConfig = JSON.parse(
  await readFile(".lighthouserc.json", "utf8"),
);
const expectedRuns = lighthouseConfig.ci.collect.numberOfRuns;
if (!Number.isInteger(expectedRuns) || expectedRuns < 1) {
  throw new Error(
    "Lighthouse config must define a positive integer numberOfRuns.",
  );
}

function getRoute(url) {
  const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
  const exactRoute = routeNames.get(pathname);
  if (exactRoute) {
    return exactRoute;
  }

  const localizedRoute = [...routeNames.entries()].find(
    ([path]) => path !== "/" && pathname.endsWith(path),
  );
  if (localizedRoute) {
    return localizedRoute[1];
  }

  return pathname.split("/").filter(Boolean).length <= 1 ? "home" : undefined;
}

async function readReports(directory) {
  const reportFiles = (await readdir(directory)).filter(
    (file) => file.startsWith("lhr-") && file.endsWith(".json"),
  );
  const reportsByRoute = new Map(
    [...routeNames.values()].map((route) => [route, []]),
  );

  for (const file of reportFiles) {
    const report = JSON.parse(await readFile(join(directory, file), "utf8"));
    const url = report.finalUrl ?? report.requestedUrl;
    if (!url) {
      throw new Error(
        `Lighthouse report ${file} has no finalUrl or requestedUrl.`,
      );
    }

    const route = getRoute(url);
    if (route) {
      reportsByRoute.get(route).push(report);
    }
  }

  for (const [route, reports] of reportsByRoute) {
    if (reports.length !== expectedRuns) {
      throw new Error(
        `Expected ${expectedRuns} Lighthouse reports for ${route} in ${directory}, found ${reports.length}.`,
      );
    }
  }

  return reportsByRoute;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function metricValue(report, definition) {
  if (definition.category) {
    const score = report.categories?.[definition.category]?.score;
    return Number.isFinite(score) ? score * 100 : Number.NaN;
  }

  return report.audits?.[definition.audit]?.numericValue;
}

function summarize(reports, definition) {
  const values = reports.map((report) => metricValue(report, definition));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Missing numeric Lighthouse value for ${definition.name}.`);
  }

  return {
    median: median(values),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function formatNumber(value, decimals) {
  return value.toFixed(decimals);
}

function formatRange(summary, definition) {
  const median = formatNumber(summary.median, definition.decimals);
  const minimum = formatNumber(summary.minimum, definition.decimals);
  const maximum = formatNumber(summary.maximum, definition.decimals);
  const unit = definition.name === "Performance" ? "%" : ` ${definition.unit}`;
  return `${median}${unit} (${minimum}–${maximum}${unit})`;
}

const baseReports = await readReports(baseDirectory);
const headReports = await readReports(headDirectory);
const rows = [];

for (const [route, reports] of headReports) {
  for (const definition of metricDefinitions) {
    const base = summarize(baseReports.get(route), definition);
    const head = summarize(reports, definition);
    const delta = head.median - base.median;
    const decimals = definition.decimals;
    const suffix =
      definition.name === "Performance" ? " pp" : ` ${definition.unit}`;
    const deltaText = `${delta >= 0 ? "+" : ""}${formatNumber(delta, decimals)}${suffix}`;

    rows.push(
      `| ${route} | ${definition.name} | ${formatRange(base, definition)} | ${formatRange(head, definition)} | ${deltaText} |`,
    );
  }
}

async function readCpuReport(directory) {
  const reportPath = join(directory, "actor-route-cpu.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (!Array.isArray(report.workloads) || report.workloads.length !== 2) {
    throw new Error(`Invalid actor CPU report in ${reportPath}.`);
  }
  return report;
}

function getCpuWorkload(report, name) {
  const workload = report.workloads.find((item) => item.name === name);
  if (!workload?.cpuMicrosPerRequest?.total) {
    throw new Error(`Missing ${name} CPU workload in actor CPU report.`);
  }
  return workload;
}

function formatCpuWorkload(workload) {
  const cpu = workload.cpuMicrosPerRequest;
  const total = cpu.total;
  const user = (cpu.user.median / 1000).toFixed(3);
  const system = (cpu.system.median / 1000).toFixed(3);
  return `${(total.median / 1000).toFixed(3)} ms total (${(total.minimum / 1000).toFixed(3)}–${(total.maximum / 1000).toFixed(3)} ms; median user ${user}, system ${system} ms)`;
}

function formatResponseBytes(workload) {
  const bytes = workload.responseBytesPerRequest;
  return `${bytes.median.toFixed(0)} (${bytes.minimum.toFixed(0)}–${bytes.maximum.toFixed(0)})`;
}

function formatTopFrames(report) {
  const large = getCpuWorkload(report, "large");
  const profile = large.profile;
  const frames = profile?.topSampledFrames;
  if (!Array.isArray(frames) || frames.length === 0) return "no sampled frames";
  const topFrames = frames
    .slice(0, 5)
    .map(
      (frame) =>
        `\`${frame.source}\` ${frame.functionName} (${frame.sampleSharePercent.toFixed(1)}%)`,
    )
    .join("; ");
  return `${profile.relevantSampleCount}/${profile.sampleCount} route/H3 samples: ${topFrames}`;
}

const baseCpuReport = await readCpuReport(baseDirectory);
const headCpuReport = await readCpuReport(headDirectory);
const baseProfileRequests = getCpuWorkload(baseCpuReport, "large").profile
  ?.requestCount;
const headProfileRequests = getCpuWorkload(headCpuReport, "large").profile
  ?.requestCount;
if (
  !Number.isInteger(baseProfileRequests) ||
  baseProfileRequests !== headProfileRequests
) {
  throw new Error("Actor CPU profile request counts differ between revisions.");
}
const cpuRows = [];
for (const name of ["representative", "large"]) {
  const base = getCpuWorkload(baseCpuReport, name);
  const head = getCpuWorkload(headCpuReport, name);
  if (
    base.creditCount !== head.creditCount ||
    base.roleCount !== head.roleCount
  ) {
    throw new Error(`Actor CPU workload ${name} differs between revisions.`);
  }
  const delta =
    (head.cpuMicrosPerRequest.total.median -
      base.cpuMicrosPerRequest.total.median) /
    1000;
  cpuRows.push(
    `| ${name} (${base.creditCount} credits, ${base.roleCount} roles; 12 returned) | ${formatResponseBytes(base)} → ${formatResponseBytes(head)} | ${formatCpuWorkload(base)} | ${formatCpuWorkload(head)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(3)} ms |`,
  );
}

const markdown = [
  "### Same-runner synthetic Lighthouse comparison",
  "",
  `Base \`${process.env.BASE_SHA ?? "unknown"}\` and PR \`${process.env.HEAD_SHA ?? "unknown"}\` were built and measured sequentially on the same GitHub runner with the same Lighthouse settings and local E2E Worker. Each route has ${expectedRuns} runs per revision.`,
  "",
  "| Route | Metric | Base median (min–max) | PR median (min–max) | PR − base |",
  "| --- | --- | ---: | ---: | ---: |",
  ...rows,
  "",
  "Performance score changes are percentage points; lower LCP, TBT, CLS, and Speed Index are better. The ranges show observed run spread, not confidence intervals. Treat small deltas as inconclusive and repeat the comparison when a decision depends on them. This lab report measures browser loading/rendering, not field Core Web Vitals or Cloudflare Worker CPU.",
].join("\n");

const cpuMarkdown = [
  "### Synthetic actor API handler CPU comparison",
  "",
  `Measurements use Node ${baseCpuReport.runtime} and ${headCpuReport.runtime}, serial H3 requests to the real actor API handler, warmed up before five unprofiled batches of 50 requests. Each request consumes the JSON response. TMDB actor data and Supabase voice-role rows are deterministic in-memory fixtures; each page returns 12 credits while the handler scans all credits. CPU is process user + system time per request; values show median and the min–max batch range.`,
  "",
  "| Workload | Response bytes/request (base → PR) | Base CPU | PR CPU | PR − base total CPU |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...cpuRows,
  "",
  `V8 sampled leaf frames from a separate ${baseProfileRequests}-request large-workload profile; raw profiles are attached to the Lighthouse artifact. Base: ${formatTopFrames(baseCpuReport)}; PR: ${formatTopFrames(headCpuReport)}. The percentages are within actor server and H3 frames; Node, Vitest, benchmark, and inspector frames are excluded. Sampled shares are approximate attribution, not exact function timings.`,
  "",
  "This is synthetic Node API-handler evidence, not Cloudflare Worker CPU. It excludes upstream network/client work and full Nuxt page SSR; use Cloudflare route-tail/profile evidence for production CPU attribution. No CI threshold is applied to these noisy synthetic measurements.",
].join("\n");

const comparison = `${markdown}\n\n${cpuMarkdown}`;
await writeFile(".lighthouseci/lighthouse-comparison.md", `${comparison}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${comparison}\n`);
}
console.log(comparison);
