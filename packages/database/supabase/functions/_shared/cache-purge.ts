import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    let res: Response;
    try {
      res = await fetch(
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
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.error("[CACHE] purge failed", await res.text());
    } else {
      console.log("[CACHE] purge ok", JSON.stringify(opts));
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[CACHE] purge skipped: Cloudflare API timed out");
    } else {
      console.error("[CACHE] purge error", error);
    }
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

/**
 * Purge the cached media page + edge-function response for a given
 * `dubbing_projects.content_type` / `content_id` pair.
 * content_type is one of: "movie" | "tv" | "game".
 */
export async function purgeMediaByContentType(
  contentType: string,
  contentId: number | string,
): Promise<void> {
  const path = contentType === "tv" ? "show" : contentType;
  await purgeCloudflareCache({
    files: [`${SITE_URL}/${path}/${contentId}`],
    tags: [`media-${path}-${contentId}`],
  });
}

/** Purge a media page by its dubbing_project id (resolves content_type/id). */
export async function purgeMediaForProject(
  supabase: SupabaseClient,
  projectId: number | string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("dubbing_projects")
      .select("content_type, content_id")
      .eq("id", projectId)
      .single();
    if (data?.content_type && data?.content_id != null) {
      await purgeMediaByContentType(data.content_type, data.content_id);
    }
  } catch (error) {
    console.error("[CACHE] purgeMediaForProject failed", error);
  }
}

/** Purge a media page by a work id (resolves via dubbing_project). */
export async function purgeMediaForWork(
  supabase: SupabaseClient,
  workId: number | string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("works")
      .select("dubbing_project_id")
      .eq("id", workId)
      .single();
    if (data?.dubbing_project_id != null) {
      await purgeMediaForProject(supabase, data.dubbing_project_id);
    }
  } catch (error) {
    console.error("[CACHE] purgeMediaForWork failed", error);
  }
}

/** Purge every media page that uses a given studio (via its dubbing projects). */
export async function purgeMediaForStudio(
  supabase: SupabaseClient,
  studioId: number | string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("dubbing_projects")
      .select("content_type, content_id")
      .eq("studio_id", studioId);
    for (const p of data ?? []) {
      if (p.content_type && p.content_id != null) {
        await purgeMediaByContentType(p.content_type, p.content_id);
      }
    }
  } catch (error) {
    console.error("[CACHE] purgeMediaForStudio failed", error);
  }
}

/**
 * Purge a voice-actor page (and, when the actor is known, the linked actor
 * page too — it renders the voice actor's profile picture). Used after any
 * mutation touching `voice_actors.profile_picture`.
 */
export async function purgeMediaForVoiceActor(
  supabase: SupabaseClient,
  voiceActorId: number | string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("voice_actors")
      .select("actor_id")
      .eq("id", voiceActorId)
      .single();
    const tags = [`media-voice-actor-${voiceActorId}`];
    if (data?.actor_id != null) {
      tags.push(`media-actor-${data.actor_id}`);
    }
    await purgeCloudflareCache({ tags });
  } catch (error) {
    console.error("[CACHE] purgeMediaForVoiceActor failed", error);
  }
}
