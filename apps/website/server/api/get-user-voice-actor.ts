import { useSupabaseAdmin } from "../utils/db/client";
import { requireUser } from "../utils/auth";
import { useTmdbClient } from "../utils";

interface TmdbCastMember {
  id: number;
  character?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

type SupabaseAdmin = ReturnType<typeof useSupabaseAdmin>;

function getVoiceActorWithWork(supabase: SupabaseAdmin, voiceActorId: number) {
  return supabase
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
    .eq("id", voiceActorId)
    .single();
}

type VoiceActorWithWork = NonNullable<Awaited<ReturnType<typeof getVoiceActorWithWork>>["data"]>;
type VoiceActorWork = VoiceActorWithWork["work"][number];
type TmdbMediaWithType = Awaited<
  ReturnType<ReturnType<typeof useTmdbClient>["getMediaWithCredits"]>
> & { media_type: "movie" | "tv" };
type PopulatedWork = VoiceActorWork & {
  character_name: string;
  media: TmdbMediaWithType;
};
type VoiceActorResponse = {
  voiceActor: VoiceActorWithWork;
  medias: PopulatedWork[];
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readPositiveId(value: unknown): number | undefined {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabaseAdmin = useSupabaseAdmin();
  const tmdbClient = useTmdbClient();

  let voiceActorIds: number[] = [];

  let targetUserId: string | undefined;
  let providedVoiceActorId: number | undefined;

  if (event.method === "POST") {
    const body: unknown = await readBody(event).catch(() => ({}));
    if (isRecord(body)) {
      targetUserId = readString(body.targetUserId);
      providedVoiceActorId = readPositiveId(body.voiceActorId);
    }
  } else {
    const query = getQuery(event);
    targetUserId = readString(query.targetUserId);
    providedVoiceActorId = readPositiveId(query.voiceActorId);
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

  const results: VoiceActorResponse[] = [];

  for (const vaId of voiceActorIds) {
    const { data: voiceActorData, error: vaError } = await getVoiceActorWithWork(
      supabaseAdmin,
      vaId,
    );

    if (vaError) {
      console.error("Error fetching voice actor:", vaError);
      continue;
    }

    if (!voiceActorData) continue;

    const result: VoiceActorResponse = {
      voiceActor: voiceActorData,
      medias: [],
    };

    const workEntries = voiceActorData.work || [];
    const populatedWorkEntries: PopulatedWork[] = [];

    for (const work of workEntries) {
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

    result.medias = populatedWorkEntries;
    results.push(result);
  }

  return { voiceActors: results };
});
