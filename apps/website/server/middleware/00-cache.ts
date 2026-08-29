import { useCache } from "../utils";

export default defineEventHandler((event) => {
  // Prime the Cloudflare KV cache resolver for this worker isolate on every request (API and SSR)
  useCache(event);
});
