import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "@app/shared-logic";

export default defineNuxtPlugin({
  name: "authenticated-fetch",
  setup() {
    const originalFetch = globalThis.$fetch;
    if (!originalFetch || Reflect.get(originalFetch, "__authWrapped")) return;

    let pendingAccessToken: Promise<string | undefined> | undefined;

    const getAccessToken = (): Promise<string | undefined> => {
      if (pendingAccessToken) return pendingAccessToken;

      const request = (async () => {
        try {
          const {
            data: { session },
          } = await useSupabaseClient().auth.getSession();
          return session?.access_token;
        } catch {
          // Ignore when Supabase client is not configured
          return undefined;
        }
      })().finally(() => {
        pendingAccessToken = undefined;
      });

      pendingAccessToken = request;
      return request;
    };

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
                const accessToken = await getAccessToken();
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
