import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function runCheck(label, vueFiles, languageFiles, output) {
  const cmd = `pnpm exec vue-i18n-extract --vueFiles "${vueFiles}" --languageFiles "${languageFiles}" --output ${output}`;
  execSync(cmd, { stdio: "ignore", cwd: process.cwd() });

  const report = JSON.parse(
    execSync(`cat ${output}`, { encoding: "utf8" }).toString()
  );

  const missing = report.missingKeys || [];
  if (missing.length > 0) {
    console.log(`❌ ${label}: ${missing.length} missing translation key(s):`);
    for (const m of missing) {
      console.log(`  - ${m.path} (${m.file}:${m.line})`);
    }
    return missing;
  }
  return [];
}

let allMissing = [];

if (existsSync("apps/website")) {
  allMissing = allMissing.concat(
    runCheck(
      "website",
      "apps/website/src/**/*.{vue,ts}",
      "apps/website/i18n/locales/*.json",
      "/tmp/i18n-report-website.json"
    )
  );
}

if (existsSync("apps/mobile/src") && existsSync("packages/locales")) {
  allMissing = allMissing.concat(
    runCheck(
      "mobile",
      "apps/mobile/src/**/*.vue",
      "packages/locales/{en,fr}.json",
      "/tmp/i18n-report-mobile.json"
    )
  );
}

if (allMissing.length > 0) {
  console.log(`\nTotal: ${allMissing.length} missing key(s)`);
  process.exit(1);
}

console.log(`✅ i18n check passed — 0 missing keys`);
