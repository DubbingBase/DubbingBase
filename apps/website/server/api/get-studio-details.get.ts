import { useSupabaseAdmin } from "../utils/db/client";
import { useTmdbClient } from "../utils";

export default defineEventHandler(async (event) => {
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

    // 3. Fetch TMDB info for projects
    const tmdbClient = useTmdbClient();
    const acceptLanguage = getHeader(event, "accept-language") || undefined;

    const projectsWithMedia = await Promise.all(
      (projects || []).map(async (p: any) => {
        try {
          const contentType = p.content_type === "movie" ? "movie" : "tv";
          const mediaDetails = await tmdbClient.fetchMediaDetails(
            p.content_id,
            contentType,
            acceptLanguage,
          );
          return { ...p, media: mediaDetails };
        } catch (e) {
          console.error(
            `Failed to fetch TMDB details for ${p.content_type} ${p.content_id}`,
            e,
          );
          return p;
        }
      }),
    );

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
