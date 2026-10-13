import { z } from "zod";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { findOrCreateDubbingProject } from "../utils/db/dubbing-project";
import { requireDubbingLanguage } from "../utils/dubbing-language";
import { findUniqueWorkRoleMatch } from "../utils/work-role-identity";

const creditSchema = z
  .object({
    voiceActor: z.string().nullish(),
    role: z.string().nullish(),
    matchedActorId: z.number().nullish(),
    matchedVoiceActor: z
      .object({
        id: z.number(),
        firstname: z.string().nullable(),
        lastname: z.string().nullable(),
      })
      .nullish(),
  })
  .passthrough();

const requestSchema = z
  .object({
    action: z.string().optional(),
    credits: z.array(creditSchema).optional(),
    mediaType: z.string().optional(),
    mediaId: z.union([z.number(), z.string()]).optional(),
    dubbing_language: z.string().optional(),
  })
  .passthrough();

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  try {
    const parsedBody = requestSchema.safeParse(await readBody(event));
    if (!parsedBody.success) {
      throw createError({ statusCode: 400, message: "Invalid request body" });
    }
    const body = parsedBody.data;
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
        credits.map(async (credit) => {
          let matchedVoiceActor: {
            id: number;
            firstname: string | null;
            lastname: string | null;
          } | null = null;
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
      const failedCredits: {
        credit: z.infer<typeof creditSchema>;
        error: unknown;
      }[] = [];

      for (const credit of credits) {
        try {
          let vaId = credit.matchedVoiceActor?.id;

          if (!vaId) {
            const voiceActor = credit.voiceActor?.trim();
            if (!voiceActor) throw new Error("Voice actor name is required");
            const parts = voiceActor.split(" ");
            const firstname = parts[0] ?? "";
            const lastname = parts.slice(1).join(" ");

            const { data: newVa, error: vaError } = await supabaseAdmin
              .from("voice_actors")
              .insert({ firstname, lastname })
              .select("id")
              .single();

            if (vaError) throw vaError;
            vaId = newVa.id;
          }

          const actorId = credit.matchedActorId ?? null;
          const roleName =
            typeof credit.role === "string" && credit.role.trim() ? credit.role : null;
          let workLookup = supabaseAdmin
            .from("work")
            .select("id, character_id, character_name")
            .eq("dubbing_project_id", projectId)
            .eq("voice_actor_id", vaId);
          workLookup = actorId
            ? workLookup.eq("actor_id", actorId)
            : workLookup.is("actor_id", null);
          const { data: existingWorks, error: workLookupError } = await workLookup;
          if (workLookupError) throw workLookupError;

          const { data: matchingWorkIds, error: identityMatchError } = await supabaseAdmin.rpc(
            "find_work_role_identity_matches",
            {
              p_work_ids: (existingWorks ?? []).map(({ id }) => id),
              p_character_id: null,
              p_character_name: roleName,
            },
          );
          if (identityMatchError) throw identityMatchError;

          const existingWork = findUniqueWorkRoleMatch(existingWorks ?? [], matchingWorkIds ?? []);
          const workUpdate = {
            performance: "dialogues",
            status: "validated",
            character_name: roleName,
          };
          let workErr: { code?: string } | null = null;
          if (existingWork) {
            const { error } = await supabaseAdmin
              .from("work")
              .update(workUpdate)
              .eq("id", existingWork.id);
            workErr = error;
          } else {
            const { error } = await supabaseAdmin.from("work").insert({
              dubbing_project_id: projectId,
              actor_id: actorId,
              voice_actor_id: vaId,
              character_name: roleName,
              performance: "dialogues",
              status: "validated",
            });
            workErr = error;
          }
          if (workErr?.code === "23505" && !existingWork) {
            let retryLookup = supabaseAdmin
              .from("work")
              .select("id, character_id, character_name")
              .eq("dubbing_project_id", projectId)
              .eq("voice_actor_id", vaId);
            retryLookup = actorId
              ? retryLookup.eq("actor_id", actorId)
              : retryLookup.is("actor_id", null);
            const { data: retryWorks, error: retryLookupError } = await retryLookup;
            if (retryLookupError) throw retryLookupError;

            const { data: retryMatchingWorkIds, error: retryIdentityMatchError } =
              await supabaseAdmin.rpc("find_work_role_identity_matches", {
                p_work_ids: (retryWorks ?? []).map(({ id }) => id),
                p_character_id: null,
                p_character_name: roleName,
              });
            if (retryIdentityMatchError) throw retryIdentityMatchError;

            const concurrentWork = findUniqueWorkRoleMatch(
              retryWorks ?? [],
              retryMatchingWorkIds ?? [],
            );
            if (!concurrentWork) throw workErr;

            const { error: retryUpdateError } = await supabaseAdmin
              .from("work")
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
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Error in process-credits:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
