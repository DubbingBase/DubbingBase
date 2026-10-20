export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    if (event.path !== "/") return;

    html.head = html.head.map((tag) =>
      tag.replace(
        /<link\b(?=[^>]*\brel=["']prefetch["'])(?=[^>]*\bhref=["']\/_nuxt\/)[^>]*>\s*/g,
        "",
      ),
    );
  });
});
