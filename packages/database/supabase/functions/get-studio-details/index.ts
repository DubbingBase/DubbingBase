import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { tmdbClient } from "../_shared/index.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { studioId } = await req.json();

      if (!studioId) {
        return Response.json(
          { error: "Missing studioId parameter" },
          { status: 400 },
        );
      }

      // 1. Fetch Studio info by ID or Name
      let query = ctx.supabase.from("studios").select("*");
      if (!isNaN(Number(studioId))) {
        query = query.eq("id", Number(studioId));
      } else {
        query = query.ilike("name", studioId);
      }

      const { data: studioData, error: studioErr } = await query.maybeSingle();
      if (studioErr) throw studioErr;

      let studio = studioData;
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
        };
      }

      // 2. Fetch dubbed projects by studio_id
      let projQuery = ctx.supabase.from("dubbing_projects").select("*");
      if (studio?.id && !isNaN(Number(studio.id))) {
        projQuery = projQuery.eq("studio_id", Number(studio.id));
      } else {
        // No valid studio.id means we can't match any projects by foreign key
        projQuery = projQuery.eq("studio_id", 0);
      }
      const { data: dubbedProjects, error: projErr } = await projQuery;
      if (projErr) throw projErr;

      const projects = dubbedProjects || [];
      let voiceActorsRoster: any[] = [];

      // 2.5 Fetch TMDB info for projects
      const projectsWithMedia = await Promise.all(
        projects.map(async (p) => {
          try {
            const contentType = p.content_type === "movie" ? "movie" : "tv";
            const mediaDetails = await tmdbClient.fetchMediaDetails(p.content_id, contentType);
            return {
              ...p,
              media: mediaDetails
            };
          } catch (e) {
            console.error(`Failed to fetch TMDB details for ${p.content_type} ${p.content_id}`, e);
            return p;
          }
        })
      );

      // 3. Fetch linked voice actors from work table
      if (projects.length > 0) {
        const projectIds = projects.map((p) => p.id);
        const { data: works, error: worksErr } = await ctx.supabase
          .from("work")
          .select("voice_actor_id")
          .in("dubbing_project_id", projectIds)
          .not("voice_actor_id", "is", null);

        if (worksErr) throw worksErr;

        if (works && works.length > 0) {
          const vaIds = Array.from(
            new Set(
              works
                .map((w) => w.voice_actor_id)
                .filter((id): id is number => id !== null),
            ),
          );
          if (vaIds.length > 0) {
            const { data: vaData, error: vaErr } = await ctx.supabase
              .from("voice_actors")
              .select("id, firstname, lastname, profile_picture")
              .in("id", vaIds);

            if (vaErr) throw vaErr;
            voiceActorsRoster = vaData || [];
          }
        }
      }

      return Response.json({
        studio,
        dubbedProjects: projectsWithMedia,
        voiceActorsRoster,
      });
    } catch (error) {
      console.error("Error in get-studio-details function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
