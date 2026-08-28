import { useSupabaseAdmin } from "../utils/db/client";
import { useTmdbClient } from "../utils";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const query = getQuery(event);
  const studioId = (query.studioId as string) || (query.studioid as string);

  const supabase = useSupabaseAdmin();

  // If no studioId, return all studios (for the studios listing page)
  if (!studioId) {
    try {
      const { data: rows, error } = await supabase
        .from("studios")
        .select("*")
        .order("name");
      if (error) throw error;
      return rows || [];
    } catch (error) {
      console.error("Error fetching studios:", error);
      throw createError({
        statusCode: 500,
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  try {
    // 1. Fetch studio by ID or name
    let studio;
    if (!isNaN(Number(studioId))) {
      const { data } = await supabase
        .from("studios")
        .select("*")
        .eq("id", Number(studioId))
        .maybeSingle();
      studio = data;
    } else {
      const { data } = await supabase
        .from("studios")
        .select("*")
        .ilike("name", studioId)
        .maybeSingle();
      studio = data;
    }

    if (!studio) {
      studio = {
        id: isNaN(Number(studioId)) ? 0 : Number(studioId),
        name: studioId,
        city: null,
        country: null,
        created_at: null,
        description: null,
        logo_url: null,
        updated_at: null,
        website_url: null,
        social_media_links: null,
      };
    }

    // 2. Fetch dubbed projects by studio_id
    const { data: projects } = await supabase
      .from("dubbing_projects")
      .select("*")
      .eq(
        "studio_id",
        studio.id && !isNaN(Number(studio.id)) ? Number(studio.id) : 0,
      );

    // 3. Fetch media info for projects (deduplicated & batched)
    const tmdbClient = useTmdbClient();
    const igdbClient = useIgdbClient();
    const openLibraryClient = useOpenLibraryClient();
    const podcastClient = usePodcastClient();
    const adClient = useAdvertisementClient();
    const toyClient = useToyClient();
    const acceptLanguage = getHeader(event, "accept-language") || undefined;

    const uniqueMediaKeys = Array.from(
      new Set(
        (projects || []).map(
          (p: any) => `${p.content_type || "movie"}:${p.content_id}`,
        ),
      ),
    );

    const mediaMap = new Map<string, any>();
    const BATCH_SIZE = 15;
    for (let i = 0; i < uniqueMediaKeys.length; i += BATCH_SIZE) {
      const batch = uniqueMediaKeys.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (key) => {
          const [contentType, contentIdStr] = key.split(":");
          const contentId = Number(contentIdStr);
          try {
            if (contentType === "audiobook") {
              const book = await openLibraryClient.getBook(contentId);
              mediaMap.set(
                key,
                book
                  ? { title: book.title, poster_path: book.cover_url }
                  : null,
              );
            } else if (contentType === "podcast") {
              const podcast = await podcastClient.getPodcast(contentId);
              mediaMap.set(
                key,
                podcast
                  ? { title: podcast.title, poster_path: podcast.cover_url }
                  : null,
              );
            } else if (contentType === "advertisement") {
              const ad = await adClient.getAdvertisement(contentId);
              mediaMap.set(
                key,
                ad ? { title: ad.title, poster_path: ad.poster_url } : null,
              );
            } else if (contentType === "toy") {
              const toy = await toyClient.getToy(contentId);
              mediaMap.set(
                key,
                toy ? { title: toy.name, poster_path: toy.cover_url } : null,
              );
            } else if (contentType === "video_game") {
              const game = await igdbClient.getGame(contentId);
              mediaMap.set(
                key,
                game
                  ? {
                      title: game.name,
                      poster_path: game.cover
                        ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
                        : null,
                    }
                  : null,
              );
            } else {
              const mediaDetails = await tmdbClient.fetchMediaDetails(
                contentId,
                contentType === "movie" ? "movie" : "tv",
                acceptLanguage,
              );
              mediaMap.set(key, mediaDetails);
            }
          } catch (e) {
            console.error(
              `Failed to fetch details for ${contentType} ${contentId}`,
              e,
            );
            mediaMap.set(key, null);
          }
        }),
      );
    }

    const projectsWithMedia = (projects || []).map((p: any) => {
      const contentType = p.content_type || "movie";
      const key = `${contentType}:${p.content_id}`;
      return { ...p, media: mediaMap.get(key) || null };
    });

    // 4. Fetch linked voice actors from work table
    let voiceActorsRoster: any[] = [];
    if (projects && projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const { data: works } = await supabase
        .from("work")
        .select("voice_actor_id")
        .in("dubbing_project_id", projectIds)
        .not("voice_actor_id", "is", null);

      if (works && works.length > 0) {
        const vaIds = [
          ...new Set(
            works
              .map((w: any) => w.voice_actor_id)
              .filter((id: any): id is number => id !== null),
          ),
        ];
        if (vaIds.length > 0) {
          const { data: vaData } = await supabase
            .from("voice_actors")
            .select("id, firstname, lastname, profile_picture")
            .in("id", vaIds);
          voiceActorsRoster = vaData || [];
        }
      }
    }

    return {
      studio,
      dubbedProjects: projectsWithMedia,
      voiceActorsRoster,
    };
  } catch (error) {
    console.error("Error in get-studio-details:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
