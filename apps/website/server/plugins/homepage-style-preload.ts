import { APP_LOCALES, DEFAULT_LOCALE } from "@app/shared-logic";
import { appendResponseHeader, getRequestURL, getResponseStatus } from "h3";

const homepagePaths = new Set([
  "/",
  ...APP_LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE).map(
    (locale) => `/${locale.code}`,
  ),
]);

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (_, { event }) => {
    if (event.method !== "GET" || getResponseStatus(event) !== 200) return;

    const pathname = getRequestURL(event).pathname.replace(/\/+$/, "") || "/";
    if (!homepagePaths.has(pathname)) return;

    const { app, homepageStylesheet } = useRuntimeConfig(event);
    if (!homepageStylesheet) return;

    const assetBase = (app.cdnURL || app.baseURL).replace(/\/+$/, "") + app.buildAssetsDir;
    // Nuxt renders stylesheets with anonymous CORS. The preload must use the same mode.
    appendResponseHeader(
      event,
      "Link",
      `<${assetBase}${homepageStylesheet}>; rel=preload; as=style; crossorigin=anonymous`,
    );
  });
});
