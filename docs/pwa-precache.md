# PWA precache policy

[Plane 56365-149](https://app.plane.so/armaldio/browse/56365-149) limits the website's Workbox precache to `offline.html`. Cloudflare deployments can retire hashed Nuxt assets; downloading those assets during worker installation can fail with `bad-precaching-response`.

`workbox.globPatterns` selects only `offline.html`. The manifest transform removes payload/build JSON globs added by Nuxt and preserves the exact `offline.html` URL. The pre-build integration hook clears the web manifest and icons added by Vite PWA as additional entries after transforms. These files remain available over HTTP and in the installation manifest. Keep `navigateFallback: null` and do not add runtime caching or navigation routes. The cached offline document is not an automatic navigation fallback.

Keep `registerType: "prompt"`, the existing registration, manifest, and `PwaLifecycleBanner` install/update actions. Browser HTTP caching, Cloudflare assets, and SSR cache policy are independent of this precache policy.

## FCM integration in PR #267

Inspected [PR #267](https://github.com/DubbingBase/DubbingBase/pull/267) at `e05a083868da9aee44c8775f2ab3163a181412db`. Its custom worker is `apps/website/src/service-worker.ts`. Before merging that PR:

1. In `apps/website/nuxt.config.ts`, retain `strategies: "injectManifest"`, `srcDir`, and `filename`. Set `injectManifest.globPatterns: ["offline.html"]` and move this change's `manifestTransforms` allowlist from `workbox` to `injectManifest`. Update the `integration.beforeBuildServiceWorker` hook to clear `options.injectManifest.additionalManifestEntries` instead of `options.workbox.additionalManifestEntries`. Settings under `workbox` do not govern the injected manifest. Do not restore the broad asset glob.
2. In `src/service-worker.ts`, remove the entire `registerRoute(new NavigationRoute(...))` registration, the `workbox-routing` import, and the `createHandlerBoundToURL` import. That route serves the offline document for matching online navigations too; adding a denylist does not meet the network navigation policy. Retain `precacheAndRoute(self.__WB_MANIFEST)` for the single document.
3. Preserve Firebase initialization, `isSupported`, `onBackgroundMessage` (Firebase's background push handling), notification display, safe notification links, and `notificationclick` window navigation/focus. Preserve the `SKIP_WAITING` message handler and the existing prompt-driven update activation. Do not replace the custom worker with the generated worker from this branch.
4. Build the integrated Cloudflare worker and inspect its injected manifest: exactly `offline.html`, no Nuxt chunks, CSS, images, fonts, or manifest. Smoke-check registration, a waiting update and activation, online navigations and failure without a navigation fallback. Run the FCM-specific notification checks separately.

This change does not implement or verify FCM delivery or installed-device notification behavior. The FCM integration edits above remain work for PR #267.
