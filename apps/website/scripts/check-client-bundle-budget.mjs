import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const websiteRoot = resolve(import.meta.dirname, "..");
const manifestCandidates = [
  resolve(websiteRoot, ".nuxt/dist/client/manifest.json"),
  resolve(websiteRoot, ".nuxt/dist/client/.vite/manifest.json"),
  resolve(websiteRoot, ".output/public/_nuxt/manifest.json"),
  resolve(websiteRoot, ".output/public/_nuxt/.vite/manifest.json"),
];

let manifestPath;
let manifestText;

for (const candidate of manifestCandidates) {
  try {
    manifestText = await readFile(candidate, "utf8");
    manifestPath = candidate;
    break;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

if (!manifestPath || !manifestText) {
  throw new Error(
    `Could not find the Vite client manifest. Checked: ${manifestCandidates.join(", ")}`,
  );
}

const manifest = JSON.parse(manifestText);
const manifestEntries = Object.entries(manifest);
const clientOutputDirectory = manifestPath.endsWith("/.vite/manifest.json")
  ? dirname(dirname(manifestPath))
  : dirname(manifestPath);

function getPageRoute(source) {
  const normalizedSource = source.replaceAll("\\", "/");
  const match = normalizedSource.match(/(?:^|\/)pages\/(.+)$/);

  if (!match) return undefined;

  const segments = match[1].split("/");
  const firstSegment = segments[0];
  const route = firstSegment === "index.vue" ? "home" : firstSegment.replace(/\.vue$/, "");

  return route.startsWith("(") ? undefined : route;
}

function getStaticClosure(startKeys) {
  const files = new Set();
  const visited = new Set();
  const pending = [...startKeys];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);

    const chunk = manifest[key];
    if (!chunk) continue;

    if (/\.(?:m?js)$/.test(chunk.file)) files.add(chunk.file);
    pending.push(...(chunk.imports ?? []));
  }

  return files;
}

async function getBundleSize(files) {
  const assets = await Promise.all(
    [...files].map(async (file) => {
      const contents = await readFile(resolve(clientOutputDirectory, file));
      return {
        rawBytes: contents.byteLength,
        gzipBytes: gzipSync(contents).byteLength,
      };
    }),
  );

  return assets.reduce(
    (total, asset) => ({
      rawBytes: total.rawBytes + asset.rawBytes,
      gzipBytes: total.gzipBytes + asset.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
}

const commonEntries = manifestEntries
  .filter(([key, chunk]) => chunk.isEntry && !getPageRoute(chunk.src ?? key))
  .map(([key]) => key);

if (commonEntries.length === 0) {
  throw new Error("No common client entry was found in the Vite manifest.");
}

const pageEntries = manifestEntries.filter(([, chunk]) => getPageRoute(chunk.src ?? ""));
const routeEntries = new Map();

for (const [key, chunk] of pageEntries) {
  const route = getPageRoute(chunk.src ?? "");
  if (!route) continue;
  routeEntries.set(route, [...(routeEntries.get(route) ?? []), key]);
}

if (routeEntries.size === 0) {
  throw new Error("No page chunks were found in the Vite manifest.");
}

const report = [];

for (const [route, entries] of routeEntries) {
  const files = getStaticClosure([...commonEntries, ...entries]);
  const size = await getBundleSize(files);
  report.push({ route, ...size, chunkCount: files.size });
}

report.sort((left, right) => right.rawBytes - left.rawBytes);

console.log("Client route JavaScript (static imports only; dynamic imports excluded):");
for (const row of report) {
  const route = row.route.padEnd(18);
  const rawBytes = `${row.rawBytes} B raw`.padStart(12);
  const gzipBytes = `${row.gzipBytes} B gzip`.padStart(13);
  console.log(`  ${route} ${rawBytes}  ${gzipBytes}  ${row.chunkCount} chunks`);
}

const publicPages = report.filter(
  (row) => row.route !== "admin" && !row.route.startsWith("admin/"),
);
const maxPublicBytes = Number(process.env.PUBLIC_INITIAL_JS_BUDGET_BYTES ?? 900_000);

if (!Number.isSafeInteger(maxPublicBytes) || maxPublicBytes <= 0) {
  throw new Error("PUBLIC_INITIAL_JS_BUDGET_BYTES must be a positive integer.");
}

const largestPublicPage = publicPages[0];
if (!largestPublicPage) throw new Error("No public page chunks were found in the Vite manifest.");

console.log(`Largest public route: ${largestPublicPage.route}`);
console.log(`Public initial JavaScript budget: ${maxPublicBytes} B raw.`);

if (largestPublicPage.rawBytes > maxPublicBytes) {
  throw new Error(
    `Public initial JavaScript budget exceeded: ${largestPublicPage.route} is ` +
      `${largestPublicPage.rawBytes} B; limit is ${maxPublicBytes} B.`,
  );
}
