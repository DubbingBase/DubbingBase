import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDirectory = resolve(import.meta.dirname, "../.output/public");
const aboutPages = [
  "about/index.html",
  "fr/about/index.html",
  "es/about/index.html",
  "ja/about/index.html",
];

function getStylesheetHref(html, pagePath) {
  const links = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g)];
  if (links.length !== 1) {
    throw new Error(`Expected one stylesheet in ${pagePath}, found ${links.length}`);
  }

  const href = links[0][0].match(/\bhref=["']([^"']+)["']/)?.[1];
  if (!href?.startsWith("/_nuxt/")) {
    throw new Error(`Expected a Nuxt stylesheet in ${pagePath}`);
  }

  return href;
}

const firstPagePath = aboutPages[0];
const firstPage = await readFile(resolve(publicDirectory, firstPagePath), "utf8");
const originalStylesheetHref = getStylesheetHref(firstPage, firstPagePath);
const originalStylesheetPath = resolve(
  publicDirectory,
  originalStylesheetHref.slice(1),
);
const stylesheet = await readFile(originalStylesheetPath, "utf8");
const fontFacePattern = /@font-face\s*\{[^{}]*\}/g;
const fontFaces = stylesheet.match(fontFacePattern) ?? [];

if (fontFaces.length === 0) {
  throw new Error("Expected unused @font-face rules in the shared stylesheet");
}

const aboutStylesheet = stylesheet.replace(fontFacePattern, "");
const hash = createHash("sha256").update(aboutStylesheet).digest("hex").slice(0, 8);
const aboutStylesheetHref = `/_nuxt/about.${hash}.css`;

await writeFile(
  resolve(publicDirectory, aboutStylesheetHref.slice(1)),
  aboutStylesheet,
);

for (const pagePath of aboutPages) {
  const html = await readFile(resolve(publicDirectory, pagePath), "utf8");
  const stylesheetHref = getStylesheetHref(html, pagePath);
  if (stylesheetHref !== originalStylesheetHref) {
    throw new Error(`Unexpected stylesheet mismatch in ${pagePath}`);
  }

  const htmlWithAboutStylesheet = html.replace(stylesheetHref, aboutStylesheetHref);
  const lightHtml = htmlWithAboutStylesheet.replace(
    'data-theme="dark"',
    'data-theme="light"',
  );
  if (lightHtml === htmlWithAboutStylesheet) {
    throw new Error(`Expected a prerendered theme attribute in ${pagePath}`);
  }

  const lightPagePath = pagePath.replace(/\/index\.html$/, ".light.html");
  await Promise.all([
    writeFile(resolve(publicDirectory, pagePath), htmlWithAboutStylesheet),
    writeFile(resolve(publicDirectory, lightPagePath), lightHtml),
  ]);
}

console.log(
  `About assets: removed ${fontFaces.length} unused font-face rules (${Buffer.byteLength(stylesheet) - Buffer.byteLength(aboutStylesheet)} bytes before compression) and generated light-theme pages`,
);
