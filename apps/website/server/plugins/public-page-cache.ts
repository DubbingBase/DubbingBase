import { getRequestHeader, getRequestURL, removeResponseHeader } from "h3";
import { setPublicCacheHeaders } from "../utils/cache/http";
import { shouldCachePublicPage } from "../utils/cache/public-pages";

// Opts allow-listed anonymous page renders into edge caching (see
// utils/cache/public-pages.ts). Set-Cookie is stripped because Cloudflare does
// not cache responses that set cookies. Theme and language cookies are
// already client-only, so this is a safeguard against regressions.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event) => {
    const config = useRuntimeConfig(event);
    const shouldCache = shouldCachePublicPage({
      method: event.method,
      pathname: getRequestURL(event).pathname,
      status: event.node.res.statusCode,
      cookieHeader: getRequestHeader(event, "cookie"),
      authorizationHeader: getRequestHeader(event, "authorization"),
      supabaseCookiePrefix: config.public.supabase?.cookiePrefix,
    });
    if (!shouldCache) return;

    removeResponseHeader(event, "set-cookie");
    setPublicCacheHeaders(event, "page");
  });
});
