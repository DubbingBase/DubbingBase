import { useSupabaseAdmin } from "../utils/db/client";
import { defineUserHandler } from "../utils/auth-handlers";
import { useTmdbClient } from "../utils";
import { isRecord } from "@app/shared-logic";

interface TmdbCastMember {
  id: number;
  character?: string;
}

function isTmdbCastMember(value: unknown): value is TmdbCastMember {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    (value.character === undefined || typeof value.character === "string")
  );
}

function getTmdbCast(value: unknown): TmdbCastMember[] {
  if (!isRecord(value)) return [];
  const credits = value.credits;
  if (!isRecord(credits) || !Array.isArray(credits.cast)) return [];
  return credits.cast.filter(isTmdbCastMember);
}

async function loadVoiceActor(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  tmdbClient: ReturnType<typeof useTmdbClient>,
  vaId: number,
) {
  const { data: voiceActorData, error: vaError } = await supabaseAdmin
    .from("voice_actors")
    .select(
      `*,
        work (
          *,
          dubbing_projects (
            content_id,
            content_type
          )
        )`,
    )
    .eq("id", vaId)
    .single();

  if (vaError) {
    console.error("Error fetching voice actor:", vaError);
    return null;
  }

  const populatedWorkEntries = [];

  for (const work of voiceActorData.work || []) {
    try {
      const contentType = work.dubbing_projects?.content_type;
      const contentId = work.dubbing_projects?.content_id;
      if (!contentType || !contentId) continue;

      if (contentType !== "movie" && contentType !== "tv") continue;

      const tmdbMedia = await tmdbClient.getMediaWithCredits(contentType, contentId, "fr-FR");

      let tmdbCharacterName: string | undefined;
      if (work.actor_id) {
        const castMember = getTmdbCast(tmdbMedia).find((member) => member.id === work.actor_id);
        tmdbCharacterName = castMember?.character;
      }

      const allCharacterNames = new Set<string>();
      if (tmdbCharacterName) {
        tmdbCharacterName.split("/").forEach((name) => allCharacterNames.add(name.trim()));
      }
      const finalCharacterName = Array.from(allCharacterNames).join(" / ");

      populatedWorkEntries.push({
        ...work,
        character_name: finalCharacterName,
        media: {
          ...tmdbMedia,
          media_type: contentType,
        },
      });
    } catch (e) {
      console.error("Error fetching media:", e);
    }
  }

  return { voiceActor: voiceActorData, medias: populatedWorkEntries };
}

export default defineUserHandler(async (event, user) => {
  const supabaseAdmin = useSupabaseAdmin();
  const tmdbClient = useTmdbClient();

  let voiceActorIds: number[] = [];

  let targetUserId: string | undefined;
  let providedVoiceActorId: number | undefined;

  if (event.method === "POST") {
    const rawBody: unknown = await readBody(event).catch(() => undefined);
    const body = isRecord(rawBody) ? rawBody : {};
    targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : undefined;
    providedVoiceActorId = body.voiceActorId ? Number(body.voiceActorId) : undefined;
  } else {
    const query = getQuery(event);
    targetUserId = query.targetUserId ? String(query.targetUserId) : undefined;
    providedVoiceActorId = query.voiceActorId ? Number(query.voiceActorId) : undefined;
  }

  if (providedVoiceActorId) {
    voiceActorIds = [providedVoiceActorId];
  } else if (targetUserId) {
    const isAdmin = user.app_metadata?.role === "admin";

    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        message: "Unauthorized: Admin access required",
      });
    }

    const { data: targetUserData, error: targetError } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (targetError || !targetUserData.user) {
      throw createError({
        statusCode: 404,
        message: "Target user not found",
      });
    }

    const { data: targetLinkData, error: targetLinkError } = await supabaseAdmin
      .from("user_voice_actor_links")
      .select("voice_actor_id")
      .eq("user_id", targetUserId);

    if (targetLinkError) {
      console.error("Error fetching target user voice actor links:", targetLinkError);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch target user voice actors",
      });
    }
    voiceActorIds = targetLinkData?.map((link) => link.voice_actor_id) || [];
  }

  if (voiceActorIds.length === 0) {
    const { data: userLinkData, error: userLinkError } = await supabaseAdmin
      .from("user_voice_actor_links")
      .select("voice_actor_id")
      .eq("user_id", user.id);

    if (userLinkError) {
      console.error("Error fetching user voice actor links:", userLinkError);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch user voice actors",
      });
    }
    voiceActorIds = userLinkData?.map((link) => link.voice_actor_id) || [];
  }

  if (voiceActorIds.length === 0) {
    return { voiceActors: [] };
  }

  const results: Awaited<ReturnType<typeof loadVoiceActor>>[] = [];

  for (const vaId of voiceActorIds) {
    const result = await loadVoiceActor(supabaseAdmin, tmdbClient, vaId);
    if (result) results.push(result);
  }

  return { voiceActors: results };
});
