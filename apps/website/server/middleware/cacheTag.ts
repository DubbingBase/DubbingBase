// Tags the cached Nuxt HTML responses for media/person pages with the same
// Cache-Tag the edge functions use, so a tag-based Cloudflare purge busts BOTH
// the SSR HTML (routeRules swr=3600) and the edge-function CDN response.
// Without this, only the file-URL purge would clear the HTML, which depends on
// PUBLIC_SITE_URL being exactly right per environment.
//
// i18n strategy is "prefix_except_default", so non-default locales are prefixed
// (e.g. /fr/movie/123). The locale prefixes are derived from the live i18n
// runtime config so any newly added language is covered automatically. The tag
// itself stays locale-independent so a single purge clears every locale variant.
const MEDIA_TYPES: string[] = ["movie", "show", "game", "voice-actor", "actor"];

export default defineEventHandler((event) => {
  const i18n = useRuntimeConfig().public?.i18n;
  const locales = Array.isArray(i18n?.locales) ? i18n.locales : [];
  const localeCodes: string[] = locales
    .map((l) => (typeof l === "string" ? l : l.code))
    .filter((c) => typeof c === "string");
  const defaultLocale: string = i18n?.defaultLocale ?? "en";
  const prefixes = localeCodes.filter((c) => c && c !== defaultLocale);

  const segments = event.path.split("/").filter(Boolean);
  const start = prefixes.includes(segments[0] ?? "") ? 1 : 0;
  const type = segments[start];
  const id = segments[start + 1];

  if (type && MEDIA_TYPES.includes(type) && id) {
    setResponseHeader(event, "Cache-Tag", `media-${type}-${id}`);
  }
});
