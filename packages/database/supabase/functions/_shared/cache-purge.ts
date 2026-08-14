/**
 * Defensive Cloudflare cache purge helper.
 *
 * Purges cached responses (both the Cloudflare HTML cache for the media page
 * and the edge-function CDN cache identified by Cache-Tag) after a mutation so
 * that edits are reflected immediately instead of waiting out the SWR window.
 *
 * No-op when the required env vars are absent, and never throws — cache
 * purging must never break the underlying mutation.
 */

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://dubbingbase.com";

interface PurgeOptions {
  files?: string[];
  tags?: string[];
  prefixes?: string[];
}

export async function purgeCloudflareCache(opts: PurgeOptions): Promise<void> {
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zone = Deno.env.get("CLOUDFLARE_ZONE_ID");

  if (!token || !zone) {
    console.log("[CACHE] purge skipped: CLOUDFLARE_API_TOKEN/ZONE_ID not set");
    return;
  }

  if (!opts.files?.length && !opts.tags?.length && !opts.prefixes?.length) {
    return;
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: opts.files ?? [],
          tags: opts.tags ?? [],
          prefixes: opts.prefixes ?? [],
        }),
      },
    );

    if (!res.ok) {
      console.error("[CACHE] purge failed", await res.text());
    } else {
      console.log("[CACHE] purge ok", JSON.stringify(opts));
    }
  } catch (error) {
    console.error("[CACHE] purge error", error);
  }
}

export function mediaPageUrl(mediaType: string, id: number | string): string {
  const path = mediaType === "tv" ? "show" : mediaType;
  return `${SITE_URL}/${path}/${id}`;
}

export function mediaCacheTag(mediaType: string, id: number | string): string {
  const path = mediaType === "tv" ? "show" : mediaType;
  return `media-${path}-${id}`;
}
