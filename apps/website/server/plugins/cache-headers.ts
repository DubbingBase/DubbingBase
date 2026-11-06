import { NO_STORE_CACHE_CONTROL } from "../utils/cache/http";
import { applyCachePolicy, applyDefaultCachePolicy } from "../utils/cache/response-policy";

// Single owner of dynamic response caching; see utils/cache/response-policy.ts.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", applyDefaultCachePolicy);

  nitroApp.hooks.hook("beforeResponse", (event) => {
    applyCachePolicy(event, {
      supabaseCookiePrefix: useRuntimeConfig(event).public.supabase?.cookiePrefix,
    });
  });

  // Safety net for responses that bypass `beforeResponse` (e.g. rendered errors).
  nitroApp.hooks.hook("response", (response: Response) => {
    if (!import.meta.dev && response.status < 400) return;

    response.headers.set("cache-control", NO_STORE_CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
    response.headers.set("expires", "0");
  });
});
