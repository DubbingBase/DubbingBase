import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const { action, credits, mediaType, mediaId } = await req.json();

      if (action === "match") {
        if (!credits || !Array.isArray(credits)) {
          return Response.json(
            { error: "Invalid credits array" },
            { status: 400 },
          );
        }

        const matchedCredits = await Promise.all(
          credits.map(async (credit: any) => {
            let matchedVoiceActor = null;
            if (credit.voiceActor && credit.voiceActor.trim() !== "") {
              const parts = credit.voiceActor.trim().split(" ");
              const firstname = parts[0];
              const lastname = parts.slice(1).join(" ");

              const { data, error } = await ctx.supabase
                .from("voice_actors")
                .select("id, firstname, lastname")
                .ilike("firstname", firstname)
                .ilike("lastname", lastname || "%")
                .limit(1)
                .maybeSingle();

              if (!error && data) {
                matchedVoiceActor = data;
              }
            }
            return {
              ...credit,
              matchedVoiceActor,
            };
          }),
        );
        return Response.json({ credits: matchedCredits });
      } else if (action === "save") {
        if (!credits || !Array.isArray(credits) || !mediaType || !mediaId) {
          return Response.json(
            { error: "Invalid parameters for save" },
            { status: 400 },
          );
        }

        let successCount = 0;
        const failedCredits = [];

        for (const credit of credits) {
          try {
            let vaId = credit.matchedVoiceActor?.id;

            // Create voice actor if not matched
            if (!vaId) {
              const parts = credit.voiceActor.trim().split(" ");
              const firstname = parts[0];
              const lastname = parts.slice(1).join(" ");

              const { data: newVa, error: vaError } = await ctx.supabase
                .from("voice_actors")
                .insert({ firstname, lastname })
                .select("id")
                .single();

              if (vaError) throw vaError;
              vaId = newVa.id;
            }

            // In an Edge Function, we shouldn't HTTP invoke another Edge Function (link-voice-actor)
            // It's better to just do the logic directly, but for brevity we can just invoke it via URL
            // OR even better, call the underlying `findOrCreateDubbingProject` and insert into `work`.
            // But we can invoke edge functions via ctx.supabase.functions.invoke.

            const { error: linkError } = await ctx.supabase.functions.invoke(
              "link-voice-actor",
              {
                body: {
                  actor_id: credit.matchedActorId || null,
                  media_type: mediaType,
                  voice_actor_id: vaId,
                  performance: credit.role || "dialogues",
                  media_id: mediaId,
                },
              },
            );

            if (linkError) throw linkError;
            successCount++;
          } catch (err) {
            console.error("Failed to process credit:", credit, err);
            failedCredits.push({ credit, error: err });
          }
        }

        return Response.json({ successCount, failedCredits });
      }

      return Response.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
      console.error("Error in process-credits function:", error);
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
