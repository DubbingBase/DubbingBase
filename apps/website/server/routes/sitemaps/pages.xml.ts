import { defineEventHandler } from "h3";
import { STATIC_SITEMAP_ROUTES, renderUrlset } from "../../utils/sitemap";
import { getSitemapOrigin, sendSitemapXml } from "../../utils/sitemap-response";

export default defineEventHandler(async (event) =>
  sendSitemapXml(
    event,
    await renderUrlset(
      getSitemapOrigin(event),
      STATIC_SITEMAP_ROUTES.map((path) => ({ path })),
    ),
  ),
);
