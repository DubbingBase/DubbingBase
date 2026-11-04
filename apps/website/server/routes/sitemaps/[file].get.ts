import { createError, defineEventHandler, getRouterParam } from "h3";
import { SITEMAP_ENTITIES, renderUrlset } from "../../utils/sitemap";
import { loadSitemapChunk } from "../../utils/sitemap-data";
import { getSitemapOrigin, sendSitemapXml } from "../../utils/sitemap-response";

const FILE_PATTERN = /^([a-z-]+)-([1-9]\d{0,3})\.xml$/;

/** Serves `/sitemaps/<entity>-<chunk>.xml`. */
export default defineEventHandler(async (event) => {
  const match = FILE_PATTERN.exec(getRouterParam(event, "file") ?? "");
  const entity = SITEMAP_ENTITIES.find(({ name }) => name === match?.[1]);
  if (!match || !entity) throw createError({ statusCode: 404, statusMessage: "Not Found" });

  const records = await loadSitemapChunk(event, entity.name, Number(match[2]));
  if (records.length === 0) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return sendSitemapXml(event, await renderUrlset(getSitemapOrigin(event), records));
});
