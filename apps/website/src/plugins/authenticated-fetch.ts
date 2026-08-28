export default defineNuxtPlugin({
  name: "authenticated-fetch",
  setup() {
    const originalFetch = globalThis.$fetch;
    if (!originalFetch || (originalFetch as any).__authWrapped) return;

    globalThis.$fetch = new Proxy(originalFetch, {
      apply(target, thisArg, args: [any, any?]) {
        const [url, options] = args;
        const urlStr = typeof url === "string" ? url : "";

        // Only attach the session token to internal, same-origin requests.
        if (!urlStr.startsWith("/")) {
          return Reflect.apply(target, thisArg, args);
        }

        return (async () => {
          try {
            const headers: Record<string, string> = {
              ...(options?.headers as Record<string, string> | undefined),
            };

            if (import.meta.server) {
              const reqHeaders = useRequestHeaders(["cookie", "authorization"]);
              if (reqHeaders.cookie && !headers.cookie && !headers.Cookie) {
                headers.cookie = reqHeaders.cookie;
              }
              if (
                reqHeaders.authorization &&
                !headers.authorization &&
                !headers.Authorization
              ) {
                headers.authorization = reqHeaders.authorization;
              }
            } else {
              const supabase = useSupabaseClient();
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (
                session?.access_token &&
                !headers.authorization &&
                !headers.Authorization
              ) {
                headers.authorization = `Bearer ${session.access_token}`;
              }
            }

            return await Reflect.apply(target, thisArg, [
              url,
              { ...options, headers },
            ]);
          } catch {
            return await Reflect.apply(target, thisArg, args);
          }
        })();
      },
    }) as typeof originalFetch;

    (globalThis.$fetch as any).__authWrapped = true;
  },
});
