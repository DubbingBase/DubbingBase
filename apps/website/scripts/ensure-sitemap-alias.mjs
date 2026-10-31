import { copyFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const publicDirectory = resolve(import.meta.dirname, "../.output/public");
const indexPath = resolve(publicDirectory, "sitemap_index.xml");
const sitemapPath = resolve(publicDirectory, "sitemap.xml");

try {
  await stat(indexPath);
} catch (error) {
  if (error.code === "ENOENT") process.exit(0);
  throw error;
}

await rm(sitemapPath, { recursive: true, force: true });
await copyFile(indexPath, sitemapPath);
