import { useSupabaseAdmin } from "../utils/db/client";
import { requireUser } from "../utils/auth";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTmdbMedia(contentType: string, contentId: number) {
  const config = useRuntimeConfig();
  const response = await fetch(
    `${TMDB_BASE}/${contentType}/${contentId}?append_to_response=credits,external_ids&language=fr-FR`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tmdbApiKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
  return response.json();
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabaseAdmin = useSupabaseAdmin();

  let voiceActorIds: number[] = [];

  let targetUserId: string | undefined;
  let providedVoiceActorId: number | undefined;

  if (event.method === "POST") {
    const body = await readBody(event).catch(() => ({}));
    targetUserId = body?.targetUserId;
    providedVoiceActorId = body?.voiceActorId
      ? Number(body.voiceActorId)
      : undefined;
  } else {
    const query = getQuery(event);
    targetUserId = query.targetUserId ? String(query.targetUserId) : undefined;
    providedVoiceActorId = query.voiceActorId
      ? Number(query.voiceActorId)
      : undefined;
  }

  if (providedVoiceActorId) {
    voiceActorIds = [providedVoiceActorId];
  } else if (targetUserId) {
    const isAdmin =
      user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin" ||
      (user as any).role === "admin";

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
      console.error(
        "Error fetching target user voice actor links:",
        targetLinkError,
      );
      throw createError({
        statusCode: 500,
        message: "Failed to fetch target user voice actors",
      });
    }
    voiceActorIds =
      targetLinkData?.map((link: any) => link.voice_actor_id) || [];
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
    voiceActorIds = userLinkData?.map((link: any) => link.voice_actor_id) || [];
  }

  if (voiceActorIds.length === 0) {
    return { voiceActors: [] };
  }

  const results: { voiceActor: any; medias: any[] }[] = [];

  for (const vaId of voiceActorIds) {
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
      continue;
    }

    const result = {
      voiceActor: voiceActorData,
      medias: [] as any[],
    };

    const workEntries = (voiceActorData as any).work || [];
    const populatedWorkEntries = [];

    for (const work of workEntries) {
      try {
        const contentType = work.dubbing_projects?.content_type;
        const contentId = work.dubbing_projects?.content_id;
        if (!contentType || !contentId) continue;

        const tmdbMedia = await fetchTmdbMedia(contentType, contentId);

        let tmdbCharacterName: string | undefined;
        if (work.actor_id && tmdbMedia.credits?.cast) {
          const castMember = tmdbMedia.credits.cast.find(
            (c: any) => c.id === work.actor_id,
          );
          tmdbCharacterName = castMember?.character;
        }

        const allCharacterNames = new Set<string>();
        if (tmdbCharacterName) {
          tmdbCharacterName
            .split("/")
            .forEach((name) => allCharacterNames.add(name.trim()));
        }
        const finalCharacterName = Array.from(allCharacterNames).join(" / ");

        populatedWorkEntries.push({
          ...work,
          character_name: finalCharacterName,
          media: {
            ...tmdbMedia,
            media_type: contentType as "movie" | "tv",
          },
        });
      } catch (e) {
        console.error("Error fetching media:", e);
      }
    }

    result.medias = populatedWorkEntries;
    results.push(result);
  }

  return { voiceActors: results };
});
