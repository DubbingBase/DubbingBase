import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "@app/shared-logic";

export default defineNuxtPlugin({
  name: "api-client",
  enforce: "pre",
  setup() {
    if (import.meta.server) return;

    const originalFetch = globalThis.$fetch;
    if (!originalFetch) return;

    globalThis.$fetch = new Proxy(originalFetch, {
      apply(target, _thisArg, args: [any, any?]) {
        const [url, options] = args;
        return Reflect.apply(target, _thisArg, [
          url,
          {
            ...options,
            headers: {
              [API_CLIENT_HEADER]: API_CLIENT_VALUE,
              ...options?.headers,
            },
          },
        ]);
      },
    });
  },
});
