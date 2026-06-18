import posthog from "posthog-js";

interface FeatureFlagOptions {
  send_event: boolean;
}

export function usePostHog() {
  if (import.meta.env.DEV) {
    // Initialize in development with tracking disabled but feature flags enabled
    posthog.init("phc_me2esmRfMkokDSbTzKQfNHaUZgpBOAqgi2921wCYOtP", {
      api_host: "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
      capture_pageview: false,
      disable_session_recording: true,
      autocapture: false,
      persistence: "memory",
    });
  } else {
    // Production initialization
    posthog.init("phc_me2esmRfMkokDSbTzKQfNHaUZgpBOAqgi2921wCYOtP", {
      api_host: "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
    });
  }

  const isFeatureEnabled = (
    key: string,
    options?: FeatureFlagOptions,
  ): boolean => {
    try {
      const result = posthog.isFeatureEnabled(key, options);
      return result ?? false;
    } catch (error) {
      console.error(`Error checking feature flag '${key}':`, error);
      return false;
    }
  };

  const getFeatureFlag = (
    key: string,
    options?: FeatureFlagOptions,
  ): string | boolean | number | undefined => {
    try {
      return posthog.getFeatureFlag(key, options);
    } catch (error) {
      console.error(`Error getting feature flag '${key}':`, error);
      return undefined;
    }
  };

  return { posthog, isFeatureEnabled, getFeatureFlag };
}
