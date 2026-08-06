import posthog from "posthog-js";

import { watch } from "vue";

export default defineNuxtPlugin({
  name: "posthog",
  enforce: "pre",
  setup() {
    const isDev = import.meta.env.DEV;

    const themeCookie = useCookie("dubbingbase-theme");
    const langCookie = useCookie("user_lang");

    if (!isDev) {
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

      posthog.register({
        application: "website",
        // @ts-ignore
        app_version: __VERSION__,
        theme: themeCookie.value || "system",
        language: langCookie.value || "en",
      });

      const user = useSupabaseUser();
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
    }

    return {
      provide: {
        posthog,
      },
    };
  },
});
