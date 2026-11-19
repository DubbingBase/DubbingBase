import { APP_LOCALES, DEFAULT_LOCALE } from "@app/shared-logic";
import { appendResponseHeader, getRequestURL, getResponseStatus } from "h3";

const homepagePaths = new Set([
  "/",
  ...APP_LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE).map(
    (locale) => `/${locale.code}`,
  ),
]);
const entryStylesheet =
  /<link rel="stylesheet" href="(\/_nuxt\/entry\.[\w-]+\.css)"(?: (crossorigin))?>/;

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    if (event.method !== "GET" || getResponseStatus(event) !== 200) return;

    const pathname = getRequestURL(event).pathname.replace(/\/+$/, "") || "/";
    if (!homepagePaths.has(pathname)) return;

    for (const chunk of html.head) {
      const match = entryStylesheet.exec(chunk);
      if (!match?.[1]) continue;

      // Cloudflare can serve this header as a 103. Match the stylesheet's CORS mode for reuse.
      const crossorigin = match[2] ? "; crossorigin=anonymous" : "";
      appendResponseHeader(event, "Link", `<${match[1]}>; rel=preload; as=style${crossorigin}`);
      break;
    }
  });
});
