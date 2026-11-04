import { setHeader, type H3Event } from "h3";
import { setPublicCacheHeaders } from "./cache/http";

/** Origin used in every sitemap URL; must match the canonical site origin. */
export function getSitemapOrigin(event: H3Event): string {
  const config = useRuntimeConfig(event);
  return String(config.public.siteUrl).replace(/\/+$/, "");
}

export function sendSitemapXml(event: H3Event, xml: string): string {
  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setPublicCacheHeaders(event, "sitemap");
  return xml;
}
