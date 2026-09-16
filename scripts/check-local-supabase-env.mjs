import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseDirectory = resolve(repositoryRoot, "packages/database");
const statusOutput = execFileSync("pnpm", ["supabase", "status", "-o", "env"], {
  cwd: databaseDirectory,
  encoding: "utf8",
});

const statusValues = new Map();
for (const line of statusOutput.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(?:"([^"]*)"|(.*))$/);
  if (match) statusValues.set(match[1], match[2] ?? match[3] ?? "");
}

const expectedValues = {
  SUPABASE_URL: "API_URL",
  SUPABASE_PUBLISHABLE_KEY: "PUBLISHABLE_KEY",
  SUPABASE_SECRET_KEY: "SECRET_KEY",
};

const mismatches = Object.entries(expectedValues).filter(
  ([name, statusName]) => process.env[name] !== statusValues.get(statusName),
);

if (mismatches.length > 0) {
  throw new Error(
    `Local Supabase environment mismatch: ${mismatches.map(([name]) => name).join(", ")}. Update the Doppler dev config to match 'pnpm supabase status -o env'.`,
  );
}

console.log("Local Supabase environment matches Doppler.");
