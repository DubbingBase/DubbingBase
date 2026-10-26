import { readFileSync } from "node:fs";

const [baseFile, baseStatusText, headFile, headStatusText] =
  process.argv.slice(2);

if (!baseFile || !baseStatusText || !headFile || !headStatusText) {
  console.error(
    "Usage: compare-oxlint-results.mjs <base-json> <base-status> <head-json> <head-status>",
  );
  process.exit(2);
}

function readResults(file, statusText) {
  const status = Number(statusText);
  if (!Number.isInteger(status) || status < 0 || status > 1) {
    throw new Error(
      `Oxlint exited unexpectedly with status ${statusText}: ${file}`,
    );
  }

  const result = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(result.diagnostics)) {
    throw new Error(`Oxlint JSON did not include diagnostics: ${file}`);
  }
  if (status === 1 && result.diagnostics.length === 0) {
    throw new Error(
      `Oxlint exited with status 1 but reported no diagnostics: ${file}`,
    );
  }

  return result.diagnostics;
}

function diagnosticKey(diagnostic) {
  const filename = diagnostic.filename
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
  const location = diagnostic.labels?.[0]?.span;
  return JSON.stringify([
    filename,
    diagnostic.code,
    diagnostic.severity,
    diagnostic.message,
    location?.line,
    location?.column,
  ]);
}

const baseDiagnostics = readResults(baseFile, baseStatusText);
const headDiagnostics = readResults(headFile, headStatusText);
const remainingBaseCounts = new Map();

for (const diagnostic of baseDiagnostics) {
  const key = diagnosticKey(diagnostic);
  remainingBaseCounts.set(key, (remainingBaseCounts.get(key) ?? 0) + 1);
}

const introduced = [];
for (const diagnostic of headDiagnostics) {
  const key = diagnosticKey(diagnostic);
  const remaining = remainingBaseCounts.get(key) ?? 0;
  if (remaining > 0) {
    remainingBaseCounts.set(key, remaining - 1);
  } else {
    introduced.push(diagnostic);
  }
}

if (introduced.length > 0) {
  console.error(
    `Website lint added ${introduced.length} diagnostic(s) compared with the base revision:`,
  );
  for (const diagnostic of introduced) {
    const location = diagnostic.labels?.[0]?.span;
    const line = location ? `:${location.line}:${location.column}` : "";
    console.error(
      `  ${diagnostic.filename}${line} ${diagnostic.code}: ${diagnostic.message}`,
    );
  }
  process.exit(1);
}

console.log(
  `Website lint found no new diagnostics (${baseDiagnostics.length} on base, ${headDiagnostics.length} on this revision).`,
);
