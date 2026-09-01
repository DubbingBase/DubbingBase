import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const websiteDir = existsSync("apps/website") ? "apps/website" : ".";
const cmd = `pnpm exec vue-i18n-extract --vueFiles "${websiteDir}/src/**/*.{vue,ts}" --languageFiles "${websiteDir}/i18n/locales/*.json" --output /tmp/i18n-report.json`;

execSync(cmd, { stdio: "ignore", cwd: process.cwd() });

const report = JSON.parse(
  execSync("cat /tmp/i18n-report.json", { encoding: "utf8" }).toString()
);

const missing = report.missingKeys || [];
if (missing.length > 0) {
  console.log(`❌ ${missing.length} missing translation key(s):`);
  for (const m of missing) {
    console.log(`  - ${m.path} (${m.file}:${m.line})`);
  }
  process.exit(1);
}

console.log(`✅ i18n check passed — 0 missing keys`);
