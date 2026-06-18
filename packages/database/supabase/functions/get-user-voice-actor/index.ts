import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { Movie, Serie } from "../_shared/types.ts";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if request body contains targetUserId for admin impersonation
      let voiceActorIds: number[] = [];

      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        console.log("body", body);
        const targetUserId = body?.targetUserId;
        const providedVoiceActorId = body?.voiceActorId;

        if (providedVoiceActorId) {
          voiceActorIds = [providedVoiceActorId];
        } else if (targetUserId) {
          // Admin impersonation logic
          const isAdmin =
            user.appMetadata?.role === "admin" ||
            user.userMetadata?.role === "admin" ||
            user.role === "admin";

          if (!isAdmin) {
            return Response.json(
              { error: "Unauthorized: Admin access required" },
              { status: 403 },
            );
          }

          const { data: targetUserData, error: targetError } =
            await ctx.supabaseAdmin.auth.admin.getUserById(targetUserId);
          if (targetError || !targetUserData.user) {
            return Response.json(
              { error: "Target user not found" },
              { status: 404 },
            );
          }

          // Query user_voice_actor_links for target user
          const { data: targetLinkData, error: targetLinkError } =
            await ctx.supabaseAdmin
              .from("user_voice_actor_links")
              .select("voice_actor_id")
              .eq("user_id", targetUserId);

          if (targetLinkError) {
            console.error(
              "Error fetching target user voice actor links:",
              targetLinkError,
            );
            return Response.json(
              { error: "Failed to fetch target user voice actors" },
              { status: 500 },
            );
          }
          voiceActorIds =
            targetLinkData?.map((link) => link.voice_actor_id) || [];
        }
      }

      if (voiceActorIds.length === 0) {
        // Fallback to the authenticated user's own voice_actor_ids from user_voice_actor_links
        const { data: userLinkData, error: userLinkError } = await ctx.supabase
          .from("user_voice_actor_links")
          .select("voice_actor_id")
          .eq("user_id", user.id);

        if (userLinkError) {
          console.error(
            "Error fetching user voice actor links:",
            userLinkError,
          );
          return Response.json(
            { error: "Failed to fetch user voice actors" },
            { status: 500 },
          );
        }
        voiceActorIds = userLinkData?.map((link) => link.voice_actor_id) || [];
      }

      if (voiceActorIds.length === 0) {
        return Response.json({ voiceActors: [] });
      }

      // Fetch voice actors data with work entries
      const results: { voiceActor: VoiceActor; medias: any[] }[] = [];

      for (const vaId of voiceActorIds) {
        const { data: voiceActorData, error: vaError } = await ctx.supabase
          .from("voice_actors")
          .select(
            `*,
            work (
              *
            )`,
          )
          .eq("id", vaId)
          .single();

        if (vaError) {
          console.error("Error fetching voice actor:", vaError);
          continue; // Skip this one
        }

        const result = {
          voiceActor: voiceActorData as unknown as VoiceActor,
          medias: [] as any[],
        };

        const workEntries = (voiceActorData as any).work || [];
        const populatedWorkEntries = [];

        for (const work of workEntries) {
          try {
            const response = await fetch(
              `https://api.themoviedb.org/3/${work.content_type}/${work.content_id}?append_to_response=credits,external_ids&language=fr-FR`,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
                  Accept: "application/json",
                },
              },
            );

            const tmdbMedia = (await response.json()) as Movie | Serie;

            // Find character name from TMDB credits using actor_id
            let tmdbCharacterName: string | undefined;
            if (work.actor_id && (tmdbMedia as any).credits?.cast) {
              const castMember = (tmdbMedia as any).credits.cast.find(
                (c: any) => c.id === work.actor_id,
              );
              tmdbCharacterName = castMember?.character;
            }

            // Combine unique names from TMDB (character) and our DB (performance)
            const allCharacterNames = new Set<string>();
            if (tmdbCharacterName) {
              tmdbCharacterName
                .split("/")
                .forEach((name) => allCharacterNames.add(name.trim()));
            }
            const finalCharacterName =
              Array.from(allCharacterNames).join(" / ");

            populatedWorkEntries.push({
              ...work,
              character_name: finalCharacterName,
              media: {
                ...tmdbMedia,
                media_type: work.content_type as "movie" | "tv",
              },
            });
          } catch (e) {
            console.error("Error fetching media:", e);
          }
        }

        result.medias = populatedWorkEntries;
        results.push(result);
      }

      return Response.json({ voiceActors: results });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
