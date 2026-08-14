// Tags the cached Nuxt HTML responses for media pages with the same Cache-Tag
// the edge functions use, so a tag-based Cloudflare purge busts BOTH the
// SSR HTML (routeRules swr=3600) and the edge-function CDN response.
// Without this, only the file-URL purge would clear the HTML, which depends
// on PUBLIC_SITE_URL being exactly right per environment.
export default defineEventHandler((event) => {
  const match = event.path.match(/^\/(movie|show|game)\/([^/?#]+)/);
  if (match) {
    setResponseHeader(event, "Cache-Tag", `media-${match[1]}-${match[2]}`);
  }
});
