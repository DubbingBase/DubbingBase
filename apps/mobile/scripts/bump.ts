// scripts/bump-version.mjs
import fs from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const bump = args.find(arg => !arg.startsWith('--')) || "patch";
const shouldTag = args.includes('--tag');
const shouldPush = args.includes('--push');

console.log(`🔧 Bumping ${bump} version...`);

// 1. Bump package.json version
execSync(`npm version ${bump} --no-git-tag-version`, { stdio: "inherit" });
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkg.version;

// 1.5 Update Capacitor build.gradle
const gradlePath = "android/app/build.gradle";
let gradleContent = fs.readFileSync(gradlePath, "utf8");
const [major, minor, patch] = version.split('.').map(Number);
const newVersionCode = major * 1000000 + minor * 1000 + patch;
gradleContent = gradleContent.replace(
  /versionCode\s+\d+/,
  `versionCode ${newVersionCode}`
).replace(
  /versionName\s+".*"/,
  `versionName "${version}"`
);
fs.writeFileSync(gradlePath, gradleContent);
console.log(`📱 Updated Capacitor versionCode to ${newVersionCode} and versionName to "${version}"`);

// 2. Update Tauri config
const tauriConfPath = "src-tauri/tauri.conf.json";
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

// 3. Update Cargo.toml
const cargoPath = "src-tauri/Cargo.toml";
const cargoToml = fs.readFileSync(cargoPath, "utf8");
const updatedToml = cargoToml.replace(
  /version\s*=\s*".*"/,
  `version = "${version}"`
);
fs.writeFileSync(cargoPath, updatedToml);

// 4. Update Cargo.lock
console.log("🦀 Updating Cargo.lock...");
execSync("cargo metadata --manifest-path src-tauri/Cargo.toml > /dev/null", { stdio: "inherit" });
// The above regenerates Cargo.lock if needed

console.log(`✅ Bumped to version ${version}`);

// 4. Commit and tag
if (shouldPush) {
  execSync(`git add .`, { stdio: "inherit" });
  execSync(`git commit -m "chore: bump version to v${version}"`, { stdio: "inherit" });
}

if (shouldTag) {
  execSync(`git tag v${version}`, { stdio: "inherit" });
  console.log(`🏷️  Created tag v${version}`);
}

// 5. Push to remote
if (shouldPush) {
  execSync(`git push && git push origin v${version}`, { stdio: "inherit" });
  console.log(`🚀 Published tag v${version} to remote`);
}
