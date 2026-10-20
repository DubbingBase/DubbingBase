import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "@app/shared-logic";
import { createAccessTokenCache } from "../utils/access-token-cache";

export default defineNuxtPlugin({
  name: "authenticated-fetch",
  setup() {
    const originalFetch = globalThis.$fetch;
    if (!originalFetch || Reflect.get(originalFetch, "__authWrapped")) return;

    let accessTokenCache: ReturnType<typeof createAccessTokenCache> | undefined;

    globalThis.$fetch = new Proxy(originalFetch, {
      apply(target, thisArg, args) {
        const [url, options] = args;
        const urlStr = typeof url === "string" ? url : "";

        // Only attach the session token to internal, same-origin requests.
        if (!urlStr.startsWith("/")) {
          return Reflect.apply(target, thisArg, args);
        }

        return (async () => {
          try {
            const headers: Record<string, string> = {
              [API_CLIENT_HEADER]: API_CLIENT_VALUE,
              ...options?.headers,
            };

            if (import.meta.server) {
              const reqHeaders = useRequestHeaders(["cookie", "authorization"]);
              if (reqHeaders.cookie && !headers.cookie && !headers.Cookie) {
                headers.cookie = reqHeaders.cookie;
              }
              if (reqHeaders.authorization && !headers.authorization && !headers.Authorization) {
                headers.authorization = reqHeaders.authorization;
              }
            } else {
              if (!headers.authorization && !headers.Authorization) {
                try {
                  accessTokenCache ??= createAccessTokenCache(useSupabaseClient().auth);
                } catch {
                  // Ignore when Supabase client is not configured.
                }
                const accessToken = await accessTokenCache?.getAccessToken();
                if (accessToken) {
                  headers.authorization = `Bearer ${accessToken}`;
                }
              }
            }

            return await Reflect.apply(target, thisArg, [url, { ...options, headers }]);
          } catch {
            return await Reflect.apply(target, thisArg, args);
          }
        })();
      },
    });

    Reflect.set(globalThis.$fetch, "__authWrapped", true);
  },
});
