import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, ".output/server");
const outputFile = resolve(outputDir, "index.mjs");

if (!existsSync(outputFile)) {
  console.log("patch-wasm: no output file found, skipping");
  process.exit(0);
}

const wasmSource = resolve(
  root,
  "node_modules/@resvg/resvg-wasm/index_bg.wasm",
);
if (!existsSync(wasmSource)) {
  console.error("patch-wasm: wasm file not found at", wasmSource);
  process.exit(1);
}

const wasmDest = resolve(outputDir, "index_bg.wasm");
copyFileSync(wasmSource, wasmDest);
console.log("patch-wasm: copied wasm to", wasmDest);

let content = readFileSync(outputFile, "utf-8");
const preamble =
  'import __RESVG_WASM from "./index_bg.wasm";globalThis.__RESVG_WASM=__RESVG_WASM;\n';
content = preamble + content;
writeFileSync(outputFile, content);
console.log("patch-wasm: patched output bundle");
