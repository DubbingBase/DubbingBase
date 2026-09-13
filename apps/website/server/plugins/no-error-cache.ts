import { NO_STORE_CACHE_CONTROL } from "../utils/cache/http";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("response", (response) => {
    if (response.status < 400) return;

    response.headers.set("cache-control", NO_STORE_CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
    response.headers.set("expires", "0");
  });
});
