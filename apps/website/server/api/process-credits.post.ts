import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { requireDubbingLanguage } from "../utils/dubbing-language";

const creditSchema = z
  .object({
    voiceActor: z.string().nullish(),
    role: z.string().nullish(),
    matchedActorId: z.number().nullish(),
    request_id: z.string().uuid().optional(),
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

function createStableCreditRequestId(
  adminId: string,
  mediaType: string,
  mediaId: number,
  language: string,
  credit: z.infer<typeof creditSchema>,
): string {
  const identity = JSON.stringify({
    adminId,
    mediaType,
    mediaId,
    language,
    voiceActorId: credit.matchedVoiceActor?.id ?? null,
    actorId: credit.matchedActorId ?? null,
    role: typeof credit.role === "string" && credit.role.trim() ? credit.role : null,
  });
  const digest = createHash("sha256").update(identity).digest("hex");
  const variant = (Number.parseInt(digest.charAt(16), 16) & 0x3) | 0x8;
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-${variant.toString(16)}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
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
            request_id: credit.request_id ?? randomUUID(),
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
      if (
        credits.some(
          (credit) =>
            !credit.matchedVoiceActor?.id && credit.voiceActor?.trim() && !credit.request_id,
        )
      ) {
        throw createError({
          statusCode: 400,
          message: "Match credits before saving unmatched voice actors",
        });
      }

      const supabaseAdmin = useSupabaseAdmin();
      const contentId = Number(mediaId);
      const dubbingLanguage = requireDubbingLanguage(dubbing_language);

      let successCount = 0;
      const failedCredits: {
        credit: z.infer<typeof creditSchema>;
        error: unknown;
      }[] = [];

      // Each RPC call is the transaction boundary for one credit. The loop
      // intentionally continues after a failure so the batch can report
      // partial success without leaving that credit's project, actor, work,
      // or audit writes partially persisted.
      for (const credit of credits) {
        try {
          const voiceActorName = credit.voiceActor?.trim() ?? "";
          if (!credit.matchedVoiceActor?.id && !voiceActorName) {
            throw new Error("Voice actor name is required");
          }
          const voiceActorNameParts = voiceActorName.split(" ");
          const requestId =
            credit.request_id ??
            createStableCreditRequestId(user.id, mediaType, contentId, dubbingLanguage, credit);
          const roleName =
            typeof credit.role === "string" && credit.role.trim() ? credit.role : null;
          const { data, error } = await supabaseAdmin.rpc("save_admin_credit_import", {
            p_admin_id: user.id,
            p_request_id: requestId,
            p_content_id: contentId,
            p_content_type: mediaType,
            p_language: dubbingLanguage,
            p_voice_actor_id: credit.matchedVoiceActor?.id ?? null,
            p_voice_actor_firstname: voiceActorNameParts[0] ?? "",
            p_voice_actor_lastname: voiceActorNameParts.slice(1).join(" "),
            p_work_actor_id: credit.matchedActorId ?? null,
            p_character_id: null,
            p_character_name: roleName,
          });

          if (error) throw error;
          if (!data || data.length !== 1) {
            throw new Error("Credit import returned an invalid result");
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
