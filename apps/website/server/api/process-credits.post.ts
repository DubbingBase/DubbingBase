import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { findOrCreateDubbingProject } from "../utils/db/dubbing-project";
import { requireDubbingLanguage } from "../utils/dubbing-language";
import {
  findUniqueWorkRoleMatch,
  workRoleIdentityKey,
} from "../utils/work-role-identity";

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  try {
    const body = await readBody(event);
    const { action, credits, mediaType, mediaId, dubbing_language } = body;

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
      const projectId = await findOrCreateDubbingProject(
        Number(mediaId),
        mediaType,
        requireDubbingLanguage(dubbing_language),
      );

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

          const actorId = credit.matchedActorId || null;
          const roleName =
            typeof credit.role === "string" && credit.role.trim()
              ? credit.role
              : null;
          const roleKey = workRoleIdentityKey(null, roleName);
          let workLookup = supabaseAdmin
            .from("work")
            .select("id, character_id, character_name")
            .eq("dubbing_project_id", projectId)
            .eq("voice_actor_id", vaId);
          workLookup = actorId
            ? workLookup.eq("actor_id", actorId)
            : workLookup.is("actor_id", null);
          const { data: existingWorks, error: workLookupError } =
            await workLookup;
          if (workLookupError) throw workLookupError;

          const existingWork = findUniqueWorkRoleMatch(
            existingWorks ?? [],
            roleKey,
          );
          const workMutation = existingWork
            ? (supabaseAdmin.from("work") as any)
                .update({
                  performance: "dialogues",
                  status: "validated",
                  character_name: roleName,
                })
                .eq("id", existingWork.id)
            : (supabaseAdmin.from("work") as any).insert({
                dubbing_project_id: projectId,
                actor_id: actorId,
                voice_actor_id: vaId,
                character_name: roleName,
                performance: "dialogues",
                status: "validated",
              });
          const { error: workErr } = await workMutation;
          if (workErr?.code === "23505" && !existingWork) {
            let retryLookup = supabaseAdmin
              .from("work")
              .select("id, character_id, character_name")
              .eq("dubbing_project_id", projectId)
              .eq("voice_actor_id", vaId);
            retryLookup = actorId
              ? retryLookup.eq("actor_id", actorId)
              : retryLookup.is("actor_id", null);
            const { data: retryWorks, error: retryLookupError } =
              await retryLookup;
            if (retryLookupError) throw retryLookupError;

            const concurrentWork = findUniqueWorkRoleMatch(
              retryWorks ?? [],
              roleKey,
            );
            if (!concurrentWork) throw workErr;

            const { error: retryUpdateError } = await (
              supabaseAdmin.from("work") as any
            )
              .update({
                performance: "dialogues",
                status: "validated",
                character_name: roleName,
              })
              .eq("id", concurrentWork.id);
            if (retryUpdateError) throw retryUpdateError;
          } else if (workErr) {
            throw workErr;
          }

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
