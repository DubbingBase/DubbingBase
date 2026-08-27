import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, ".output/server");

if (!existsSync(outputDir)) {
  console.log("patch-wasm: .output/server not found, skipping");
  process.exit(0);
}

// Locate resvg.wasm from package
let wasmSource;
try {
  wasmSource = fileURLToPath(import.meta.resolve("@cf-wasm/resvg/resvg.wasm"));
} catch {
  wasmSource = resolve(root, "node_modules/@cf-wasm/resvg/dist/lib/resvg.wasm");
}

if (!existsSync(wasmSource)) {
  console.error("patch-wasm: resvg.wasm not found at", wasmSource);
  process.exit(1);
}

const targetWasm = resolve(outputDir, "resvg.wasm");
copyFileSync(wasmSource, targetWasm);
console.log("patch-wasm: copied resvg.wasm to", targetWasm);

// Recursively find all .mjs files in outputDir and fix broken wasm import paths
function fixImports(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = resolve(dir, file);
    if (statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (file.endsWith(".mjs")) {
      let content = readFileSync(fullPath, "utf-8");
      if (content.includes("resvg.wasm")) {
        const relPath = relative(dirname(fullPath), targetWasm).replace(/\\/g, "/");
        const importSpecifier = relPath.startsWith(".") ? relPath : `./${relPath}`;
        const newContent = content.replace(/(from\s*["'])[^"']*resvg\.wasm["']/g, `$1${importSpecifier}"`);
        if (newContent !== content) {
          writeFileSync(fullPath, newContent);
          console.log(`patch-wasm: patched wasm import in ${relative(outputDir, fullPath)} -> ${importSpecifier}`);
        }
      }
    }
  }
}

fixImports(outputDir);
console.log("patch-wasm: finished patching wasm paths");
