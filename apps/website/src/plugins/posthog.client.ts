import { watch } from "vue";

export default defineNuxtPlugin({
  name: "posthog",
  enforce: "pre",
  setup(nuxtApp) {
    const isDev = import.meta.dev;
    const isTest = Boolean(import.meta.test || process.env.NODE_ENV === "test");

    if (isDev || isTest) return;

    const themeCookie = useCookie("dubbingbase-theme");
    const langCookie = useCookie("user_lang");
    const user = useSupabaseUser();

    const initializePostHog = (landingUrl: string, landingTime: Date) => {
      void import("posthog-js")
        .then(({ default: posthog }) => {
          posthog.init("phc_me2esmRfMkokDSbTzKQfNHaUZgpBOAqgi2921wCYOtP", {
            api_host: "https://n.dubbingbase.com",
            defaults: "2026-05-30",
            person_profiles: "identified_only",
            persistence: "cookie",
            autocapture: true,
            capture_pageview: true,
            capture_exceptions: {
              capture_unhandled_errors: true,
              capture_unhandled_rejections: true,
              capture_console_errors: true,
            },
          });

          // PostHog captures the current URL on init; preserve the landing page if navigation happened while loading.
          if (window.location.href !== landingUrl) {
            posthog.capture("$pageview", { $current_url: landingUrl }, { timestamp: landingTime });
          }

          posthog.register({
            application: "website",
            // @ts-ignore
            app_version: __VERSION__,
            theme: themeCookie.value || "system",
            language: langCookie.value || "en",
          });

          watch(
            user,
            (newUser) => {
              if (newUser?.id) {
                posthog.identify(newUser.id);
              } else {
                posthog.reset();
              }
            },
            { immediate: true },
          );

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
