// Injected at build time by nuxt.config.ts `vite.define`.
declare const __VERSION__: string;

export default defineNuxtPlugin({
  name: "posthog",
  enforce: "pre",
  setup(nuxtApp) {
    const isDev = import.meta.dev;
    const isTest = Boolean(import.meta.test || process.env.NODE_ENV === "test");

    if (isDev || isTest) return;

    const initializePostHog = (landingUrl: string, landingTime: Date) => {
      void import("posthog-js")
        .then(({ default: posthog }) => {
          posthog.init("phc_me2esmRfMkokDSbTzKQfNHaUZgpBOAqgi2921wCYOtP", {
            api_host: "https://n.dubbingbase.com",
            defaults: "2026-05-30",
            person_profiles: "identified_only",
            // Anonymous and minimal: no cookie or storage (the visitor id lives in memory and
            // resets on every page load), no person profiles, no click, error or page-leave capture.
            // Only page views are sent (including client-side route changes), matching what the
            // privacy page promises.
            persistence: "memory",
            autocapture: false,
            capture_exceptions: false,
            capture_pageleave: false,
            capture_pageview: "history_change",
            disable_surveys: true,
          });

          // PostHog captures the current URL on init; preserve the landing page if navigation happened while loading.
          if (window.location.href !== landingUrl) {
            posthog.capture("$pageview", { $current_url: landingUrl }, { timestamp: landingTime });
          }

          posthog.register({ application: "website", app_version: __VERSION__ });

          nuxtApp.provide("posthog", posthog);
        })
        .catch((error: unknown) => {
          console.error("Failed to load PostHog", error);
        });
    };

    nuxtApp.hook("app:mounted", () => {
      const landingUrl = window.location.href;
      const landingTime = new Date();
      const initializeWithLandingUrl = () => initializePostHog(landingUrl, landingTime);
      const requestIdleCallback = Reflect.get(window, "requestIdleCallback");

      if (typeof requestIdleCallback === "function") {
        Reflect.apply(requestIdleCallback, window, [initializeWithLandingUrl, { timeout: 2000 }]);
        return;
      }

      window.setTimeout(initializeWithLandingUrl, 1000);
    });
  },
});
