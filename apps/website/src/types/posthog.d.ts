declare module "#app" {
  interface NuxtApp {
    $posthog: typeof import("posthog-js").default | undefined;
  }
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $posthog: typeof import("posthog-js").default | undefined;
  }
}

export {};
