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
    gradleContent = gradleContent.replace(
      /versionCode\s+\d+/,
      `versionCode ${newVersionCode}`,
    ).replace(
      /versionName\s+".*"/,
      `versionName "${version}"`,
    );
    fs.writeFileSync(gradlePath, gradleContent);
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

    // 2.4 Update Cargo.lock
    console.log("   Updating Cargo.lock...");
    execSync(
      "cargo metadata --manifest-path apps/mobile/src-tauri/Cargo.toml > /dev/null",
      { stdio: "inherit" },
    );
  }
} else {
  console.warn(
    `⚠️  Mobile package.json not found at ${mobilePkgPath}, skipping mobile version sync.`,
  );
}

console.log(`✅ Bumped versions`);

// 3. Commit and tag
if (shouldPush) {
  execSync(`git add .`, { stdio: "inherit" });
  execSync(`git commit -m "chore: bump versions"`, { stdio: "inherit" });

  if (version) {
    execSync(`git tag v${version}`, { stdio: "inherit" });
    console.log(`🏷️  Created tag v${version}`);
    execSync(`git push && git push origin v${version}`, { stdio: "inherit" });
    console.log(`🚀 Published tag v${version} to remote`);
  } else {
    execSync(`git push`, { stdio: "inherit" });
    console.log(`🚀 Published to remote`);
  }
}
