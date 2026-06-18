import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse query parameters for pagination
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const offset = (page - 1) * limit;

      // Fetch voice_actor links for the user with pagination
      const {
        data: voiceActorLinks,
        error: vaLinkError,
        count,
      } = await ctx.supabase
        .from("user_voice_actor_links")
        .select("voice_actor_id", { count: "exact" })
        .eq("user_id", user.id)
        .range(offset, offset + limit - 1);

      if (vaLinkError) {
        console.error("Error fetching voice actor links:", vaLinkError);
        return Response.json(
          { error: "Failed to fetch voice actors" },
          { status: 500 },
        );
      }

      // Fetch voice actor profiles
      const voiceActors: any[] = [];
      if (voiceActorLinks && voiceActorLinks.length > 0) {
        for (const link of voiceActorLinks) {
          const { data: voiceActorData, error: vaError } = await ctx.supabase
            .from("voice_actors")
            .select("*")
            .eq("id", link.voice_actor_id)
            .single();

          if (vaError) {
            console.error("Error fetching voice actor:", vaError);
            continue; // Skip this one
          }

          voiceActors.push(voiceActorData);
        }
      }

      // Calculate pagination metadata
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return Response.json({
        voice_actors: voiceActors,
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next_page: hasNextPage,
          has_prev_page: hasPrevPage,
        },
        metadata: {
          primary_voice_actor_id:
            voiceActors.length > 0 ? voiceActors[0].id : null,
        },
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
