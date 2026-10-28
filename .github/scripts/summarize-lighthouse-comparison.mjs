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

await writeFile(".lighthouseci/lighthouse-comparison.md", `${markdown}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
console.log(markdown);
