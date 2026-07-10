import fs from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const shouldPush = args.includes("--push");

console.log(`🔧 Bumping versions...`);

// 1. Bump versions using changesets
execSync(`pnpm changeset version`, { stdio: "inherit" });

// 2. Sync Mobile App Version to Native Files
const mobilePkgPath = "apps/mobile/package.json";
let version = "";
const modifiedFiles: string[] = [];

if (fs.existsSync(mobilePkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(mobilePkgPath, "utf8"));
  version = pkg.version;
  console.log(`📱 Syncing mobile version ${version} to native files...`);

  // 2.1 Update Capacitor build.gradle
  const gradlePath = "apps/mobile/android/app/build.gradle";
  if (fs.existsSync(gradlePath)) {
    let gradleContent = fs.readFileSync(gradlePath, "utf8");
    const [major, minor, patch] = version.split(".").map(Number);
    const newVersionCode = major * 1000000 + minor * 1000 + patch;

    if (gradleContent.includes("System.getenv")) {
      gradleContent = gradleContent
        .replace(/(versionCode\s+.*?:\s+)\d+/, `$1${newVersionCode}`)
        .replace(/(versionName\s+.*?\?:\s+)".*?"/, `$1"${version}"`);
    } else {
      gradleContent = gradleContent
        .replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`)
        .replace(/versionName\s+".*"/, `versionName "${version}"`);
    }

    fs.writeFileSync(gradlePath, gradleContent);
    modifiedFiles.push(gradlePath);
    console.log(
      `   Updated Capacitor versionCode to ${newVersionCode} and versionName to "${version}"`,
    );
  }

  // 2.2 Update Tauri config
  const tauriConfPath = "apps/mobile/src-tauri/tauri.conf.json";
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));
    modifiedFiles.push(tauriConfPath);
    console.log(`   Updated Tauri config version`);
  }

  // 2.3 Update Cargo.toml
  const cargoPath = "apps/mobile/src-tauri/Cargo.toml";
  if (fs.existsSync(cargoPath)) {
    const cargoToml = fs.readFileSync(cargoPath, "utf8");
    const updatedToml = cargoToml.replace(
      /version\s*=\s*".*"/,
      `version = "${version}"`,
    );
    fs.writeFileSync(cargoPath, updatedToml);
    modifiedFiles.push(cargoPath);

    // 2.4 Update Cargo.lock
    console.log("   Updating Cargo.lock...");
    execSync(
      "cargo metadata --manifest-path apps/mobile/src-tauri/Cargo.toml > /dev/null",
      { stdio: "inherit" },
    );
    modifiedFiles.push("apps/mobile/src-tauri/Cargo.lock");
  }
} else {
  console.warn(
    `⚠️  Mobile package.json not found at ${mobilePkgPath}, skipping mobile version sync.`,
  );
}

console.log(`✅ Bumped versions`);

// 3. Commit and tag
if (shouldPush) {
  // Stage only the files updated by this sync script
  for (const file of modifiedFiles) {
    if (fs.existsSync(file)) {
      execSync(`git add ${file}`, { stdio: "inherit" });
    }
  }

  // Commit only if there are actually version sync files staged
  try {
    execSync(`git diff --cached --quiet`);
    console.log("   No native version changes to commit");
  } catch (error) {
    execSync(`git commit -m "chore: sync native versions"`, { stdio: "inherit" });
  }

  execSync(`pnpm changeset tag`, { stdio: "inherit" });
  console.log(`🏷️  Created changeset tags`);
  execSync(`git push && git push origin --tags`, { stdio: "inherit" });
  console.log(`🚀 Published commits and tags to remote`);
}

