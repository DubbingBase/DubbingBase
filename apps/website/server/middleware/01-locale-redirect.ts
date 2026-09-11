import {
  defineEventHandler,
  getCookie,
  getHeader,
  getRequestURL,
  sendRedirect,
} from "h3";

const LOCALES = ["en", "fr", "es", "ja"] as const;
type Locale = (typeof LOCALES)[number];

export default defineEventHandler((event) => {
  if (event.method !== "GET") return;

  const preferredLocale = getCookie(event, "user_lang");
  if (!LOCALES.some((locale) => locale === preferredLocale)) return;

  const url = getRequestURL(event);
  const acceptsHtml = getHeader(event, "accept")?.includes("text/html");
  if (
    !acceptsHtml ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_nuxt/")
  ) {
    return;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const routeLocale = LOCALES.find((locale) => locale === pathSegments[0]);
  const currentLocale: Locale = routeLocale ?? "en";

  if (currentLocale === preferredLocale) return;

  const contentSegments = routeLocale ? pathSegments.slice(1) : pathSegments;
  const localePrefix = preferredLocale === "en" ? "" : `/${preferredLocale}`;
  const contentPath = contentSegments.length
    ? `/${contentSegments.join("/")}`
    : "/";

  return sendRedirect(
    event,
    `${localePrefix}${contentPath}${url.search}${url.hash}`,
    302,
  );
});
