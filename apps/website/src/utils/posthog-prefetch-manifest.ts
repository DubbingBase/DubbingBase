export interface ClientManifestEntry {
  isDynamicEntry?: boolean;
  prefetch?: boolean;
  src?: string;
}

export function deferPosthogPrefetch(manifest: Record<string, ClientManifestEntry>): void {
  for (const entry of Object.values(manifest)) {
    if (!entry.isDynamicEntry || typeof entry.src !== "string") continue;

    const packageSegments = entry.src.split(/[\\/]/);
    const isPosthogModule = packageSegments.some(
      (segment) => segment === "posthog-js" || segment.startsWith("posthog-js@"),
    );

    if (isPosthogModule) entry.prefetch = false;
  }
}
