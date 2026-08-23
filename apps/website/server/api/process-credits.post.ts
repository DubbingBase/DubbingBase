import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { action, credits, mediaType, mediaId } = body;

    if (action === "match") {
      if (!credits || !Array.isArray(credits)) {
        throw createError({
          statusCode: 400,
          message: "Invalid credits array",
        });
      }

      const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

      const matchedCredits = await Promise.all(
        credits.map(async (credit: any) => {
          let matchedVoiceActor = null;
          if (credit.voiceActor && credit.voiceActor.trim() !== "") {
            const parts = credit.voiceActor.trim().split(" ");
            const firstname = parts[0];
            const lastname = parts.slice(1).join(" ");

            const { data, error } = await supabase
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
      return { credits: matchedCredits };
    } else if (action === "save") {
      if (!credits || !Array.isArray(credits) || !mediaType || !mediaId) {
        throw createError({
          statusCode: 400,
          message: "Invalid parameters for save",
        });
      }

      const supabaseAdmin = useSupabaseAdmin();

      let successCount = 0;
      const failedCredits: any[] = [];

      for (const credit of credits) {
        try {
          let vaId = credit.matchedVoiceActor?.id;

          if (!vaId) {
            const parts = credit.voiceActor.trim().split(" ");
            const firstname = parts[0];
            const lastname = parts.slice(1).join(" ");

            const { data: newVa, error: vaError } = await supabaseAdmin
              .from("voice_actors")
              .insert({ firstname, lastname })
              .select("id")
              .single();

            if (vaError) throw vaError;
            vaId = newVa.id;
          }

          // Inline the link-voice-actor logic
          // Find or create dubbing project
          const { data: project, error: projErr } = await supabaseAdmin
            .from("dubbing_projects")
            .select("id")
            .eq("content_id", mediaId)
            .eq("content_type", mediaType)
            .maybeSingle();

          let projectId = project?.id;
          if (!projectId) {
            const { data: newProj, error: newProjErr } = await (
              supabaseAdmin.from("dubbing_projects") as any
            )
              .insert({ content_id: mediaId, content_type: mediaType })
              .select("id")
              .single();
            if (newProjErr) throw newProjErr;
            projectId = newProj.id;
          }

          const { error: workErr } = await (
            supabaseAdmin.from("work") as any
          ).upsert(
            {
              dubbing_project_id: projectId,
              actor_id: credit.matchedActorId || null,
              voice_actor_id: vaId,
              performance: "dialogues",
              status: "validated",
            },
            { onConflict: "dubbing_project_id,voice_actor_id" },
          );
          if (workErr) throw workErr;

          successCount++;
        } catch (err) {
          console.error("Failed to process credit:", credit, err);
          failedCredits.push({ credit, error: err });
        }
      }

      return { successCount, failedCredits };
    }

    throw createError({ statusCode: 400, message: "Invalid action" });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in process-credits:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
