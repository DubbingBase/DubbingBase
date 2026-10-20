import { describe, expect, it } from "vitest";
import { deferPosthogPrefetch, type ClientManifestEntry } from "./posthog-prefetch-manifest";

describe("deferPosthogPrefetch", () => {
  it("disables only prefetch for the dynamic PostHog module", () => {
    const posthog: ClientManifestEntry & { preload?: boolean; module?: boolean } = {
      src: "../../../node_modules/.pnpm/posthog-js@1.429.2/node_modules/posthog-js/dist/module.mjs",
      isDynamicEntry: true,
      prefetch: true,
      preload: true,
      module: true,
    };
    const app: ClientManifestEntry = {
      src: "../node_modules/app/src/client.ts",
      isDynamicEntry: true,
      prefetch: true,
    };
    const staticPosthogAsset: ClientManifestEntry = {
      src: "../node_modules/posthog-js/dist/module.mjs",
      prefetch: true,
    };

    deferPosthogPrefetch({ posthog, app, staticPosthogAsset });

    expect(posthog).toMatchObject({ prefetch: false, preload: true, module: true });
    expect(app.prefetch).toBe(true);
    expect(staticPosthogAsset.prefetch).toBe(true);
  });

  it("recognizes package segments on Windows paths", () => {
    const entry: ClientManifestEntry = {
      src: "..\\node_modules\\posthog-js\\dist\\module.mjs",
      isDynamicEntry: true,
      prefetch: true,
    };

    deferPosthogPrefetch({ entry });

    expect(entry.prefetch).toBe(false);
  });
});
