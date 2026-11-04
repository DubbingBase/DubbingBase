import { defineEventHandler } from "h3";
import { SITEMAP_ENTITIES, renderSitemapIndex } from "../utils/sitemap";
import { listSitemapChunks } from "../utils/sitemap-data";
import { getSitemapOrigin, sendSitemapXml } from "../utils/sitemap-response";

/** Sitemap index: one static-pages sitemap plus chunked child sitemaps per entity. */
export default defineEventHandler(async (event) => {
  const chunks = await listSitemapChunks(event);
  const sitemaps = [
    { path: "/sitemaps/pages.xml" },
    ...SITEMAP_ENTITIES.flatMap(({ name }) => {
      const count = chunks.find((entry) => entry.name === name)?.chunks ?? 0;
      return Array.from({ length: count }, (_, index) => ({
        path: `/sitemaps/${name}-${index + 1}.xml`,
      }));
    }),
  ];
  return sendSitemapXml(event, await renderSitemapIndex(getSitemapOrigin(event), sitemaps));
});
