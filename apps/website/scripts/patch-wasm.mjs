import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, ".output/server");

if (!existsSync(outputDir)) {
  console.log("patch-wasm: .output/server not found, skipping");
  process.exit(0);
}

const wasmModules = [
  {
    name: "resvg.wasm",
    specifier: "@cf-wasm/resvg/resvg.wasm",
    fallback: resolve(root, "node_modules/@cf-wasm/resvg/dist/lib/resvg.wasm"),
    target: resolve(outputDir, "resvg.wasm"),
  },
  {
    name: "yoga.wasm",
    specifier: "@cf-wasm/satori/yoga.wasm",
    fallback: resolve(root, "node_modules/@cf-wasm/satori/dist/lib/yoga.wasm"),
    target: resolve(outputDir, "yoga.wasm"),
  },
];

for (const mod of wasmModules) {
  let source;
  try {
    source = fileURLToPath(import.meta.resolve(mod.specifier));
  } catch {
    source = mod.fallback;
  }

  if (existsSync(source)) {
    copyFileSync(source, mod.target);
    console.log(`patch-wasm: copied ${mod.name} to ${mod.target}`);
  } else {
    console.warn(`patch-wasm: could not find source for ${mod.name}`);
  }
}

// Recursively find all .mjs files in outputDir and fix broken wasm import paths
function fixImports(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = resolve(dir, file);
    if (statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (file.endsWith(".mjs")) {
      let content = readFileSync(fullPath, "utf-8");
      let modified = false;

      for (const mod of wasmModules) {
        if (content.includes(mod.name)) {
          const relPath = relative(dirname(fullPath), mod.target).replace(/\\/g, "/");
          const importSpecifier = relPath.startsWith(".") ? relPath : `./${relPath}`;
          const regex = new RegExp(`(from\\s*["'])[^"']*${mod.name.replace(".", "\\.")}["']`, "g");
          const newContent = content.replace(regex, `$1${importSpecifier}"`);
          if (newContent !== content) {
            content = newContent;
            modified = true;
            console.log(`patch-wasm: patched ${mod.name} import in ${relative(outputDir, fullPath)} -> ${importSpecifier}`);
          }
        }
      }

      if (modified) {
        writeFileSync(fullPath, content);
      }
    }
  }
}

fixImports(outputDir);
console.log("patch-wasm: finished patching wasm paths");
