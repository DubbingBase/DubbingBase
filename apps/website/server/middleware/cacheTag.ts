// Tags the cached Nuxt HTML responses for media pages with the same Cache-Tag
// the edge functions use, so a tag-based Cloudflare purge busts BOTH the
// SSR HTML (routeRules swr=3600) and the edge-function CDN response.
// Without this, only the file-URL purge would clear the HTML, which depends
// on PUBLIC_SITE_URL being exactly right per environment.
//
// i18n strategy is "prefix_except_default", so non-English locales are
// prefixed (e.g. /fr/movie/123). The tag stays locale-independent so a single
// purge clears every locale variant of the same media item.
export default defineEventHandler((event) => {
  const match = event.path.match(/^\/(?:fr\/)?(movie|show|game)\/([^/?#]+)/);
  if (match) {
    setResponseHeader(event, "Cache-Tag", `media-${match[1]}-${match[2]}`);
  }
});
