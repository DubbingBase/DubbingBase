import type { H3Event } from "h3";
import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { useIgdbClient, useOpenLibraryClient, usePodcastClient, useTmdbClient } from "../utils";
import { requireDubbingLanguage } from "../utils/dubbing-language";

type MediaType = "movie" | "tv" | "video_game" | "audiobook" | "podcast" | "advertisement" | "toy";

const MEDIA_TYPES: readonly MediaType[] = [
  "movie",
  "tv",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
];

const PERFORMANCES = [
  "dialogues",
  "chant",
  "dialogues & chant",
  "bruitages",
  "narration",
  "ambiances",
  "voice",
] as const;

interface LinkBody {
  request_id: string;
  voice_actor_id: number;
  media_type: MediaType;
  media_id: number;
  character_name: string;
  performance: (typeof PERFORMANCES)[number];
  actor_id: number | null;
  dubbing_language: string;
}

function linkError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isMediaType(value: unknown): value is MediaType {
  return MEDIA_TYPES.some((mediaType) => mediaType === value);
}

function isPerformance(value: unknown): value is (typeof PERFORMANCES)[number] {
  return PERFORMANCES.some((performance) => performance === value);
}

function parseBody(value: unknown): LinkBody {
  if (!isRecord(value)) {
    throw linkError(400, "Invalid voice actor work request");
  }

  if ("targetUserId" in value) {
    throw linkError(403, "Acting user is taken from the authenticated session");
  }

  if (
    !hasOnlyKeys(value, [
      "request_id",
      "voice_actor_id",
      "media_type",
      "media_id",
      "character_name",
      "performance",
      "actor_id",
      "dubbing_language",
    ])
  ) {
    throw linkError(400, "Request contains an unknown or protected field");
  }

  const actorId = value.actor_id;
  const mediaType = value.media_type;
  const mediaId = value.media_id;
  const characterName = value.character_name;
  const performance = value.performance;
  if (
    !isUuid(value.request_id) ||
    !isPositiveId(value.voice_actor_id) ||
    !isMediaType(mediaType) ||
    typeof mediaId !== "number" ||
    !Number.isSafeInteger(mediaId) ||
    mediaId === 0 ||
    (mediaId < 0 && mediaType !== "advertisement" && mediaType !== "toy") ||
    (actorId !== undefined && actorId !== null && actorId !== 0 && !isPositiveId(actorId)) ||
    typeof characterName !== "string" ||
    characterName.trim().length === 0 ||
    characterName.length > 300 ||
    !isPerformance(performance) ||
    typeof value.dubbing_language !== "string"
  ) {
    throw linkError(400, "Voice actor work fields are invalid");
  }

  const parsedActorId = actorId === undefined || actorId === null || actorId === 0 ? null : actorId;
  if (
    parsedActorId !== null &&
    mediaType !== "movie" &&
    mediaType !== "tv" &&
    mediaType !== "video_game"
  ) {
    throw linkError(400, "The selected media type does not support actor ids");
  }

  return {
    request_id: value.request_id,
    voice_actor_id: value.voice_actor_id,
    media_type: mediaType,
    media_id: mediaId,
    character_name: characterName,
    performance,
    actor_id: parsedActorId,
    dubbing_language: value.dubbing_language,
  };
}

function providerError(error: unknown, provider: string) {
  const missing = error instanceof Error && /(?:404|not found)/i.test(error.message);
  throw linkError(
    missing ? 422 : 503,
    missing
      ? `The selected media does not exist in ${provider}`
      : `${provider} could not verify this link; try again`,
  );
}

async function validateMediaReference(event: H3Event, body: LinkBody) {
  if (body.media_type === "movie" || body.media_type === "tv") {
    let media: unknown;
    try {
      media = await useTmdbClient().fetchMediaDetails(body.media_id, body.media_type);
    } catch (error) {
      providerError(error, "TMDB");
    }
    if (!isRecord(media) || media.id !== body.media_id) {
      throw linkError(422, "The selected media does not exist in TMDB");
    }
    if (body.actor_id !== null) {
      const credits = media.credits;
      const cast = isRecord(credits) ? credits.cast : null;
      if (
        !Array.isArray(cast) ||
        !cast.some((person: unknown) => isRecord(person) && person.id === body.actor_id)
      ) {
        throw linkError(422, "The selected actor does not belong to this media");
      }
    }
    return;
  }

  if (body.media_type === "video_game") {
    const igdb = useIgdbClient();
    let game: Awaited<ReturnType<typeof igdb.getGame>> | undefined;
    try {
      game = await igdb.getGame(body.media_id);
    } catch (error) {
      providerError(error, "IGDB");
    }
    if (!game || game.id !== body.media_id) {
      throw linkError(422, "The selected game does not exist in IGDB");
    }
    if (body.actor_id !== null) {
      try {
        const characters = await igdb.getGameCharacters(body.media_id);
        if (!characters.some((character) => character.id === body.actor_id)) {
          throw linkError(422, "The selected character does not belong to this game");
        }
      } catch (error) {
        if (error && typeof error === "object" && "statusCode" in error) {
          throw error;
        }
        providerError(error, "IGDB");
      }
    }
    return;
  }

  if (body.media_type === "audiobook") {
    let book: Awaited<ReturnType<ReturnType<typeof useOpenLibraryClient>["getBook"]>> | undefined;
    try {
      book = await useOpenLibraryClient().getBook(body.media_id);
    } catch (error) {
      providerError(error, "Open Library");
    }
    if (!book || book.id !== body.media_id) {
      throw linkError(422, "The selected audiobook does not exist in Open Library");
    }
    return;
  }

  if (body.media_type === "podcast") {
    let podcast: Awaited<ReturnType<ReturnType<typeof usePodcastClient>["getPodcast"]>> | undefined;
    try {
      podcast = await usePodcastClient().getPodcast(body.media_id);
    } catch (error) {
      providerError(error, "iTunes");
    }
    if (!podcast || podcast.id !== body.media_id || podcast.title === `Podcast #${body.media_id}`) {
      throw linkError(422, "The selected podcast does not exist in iTunes");
    }
    return;
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", body.media_id)
    .eq("content_type", body.media_type)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to verify internal media reference", {
      code: error.code,
    });
    throw linkError(500, "The selected internal media could not be verified");
  }
  if (!data) {
    throw linkError(422, "The selected internal media does not exist");
  }
}

function mapRpcError(code: string) {
  if (code === "42501" || code === "28000") {
    throw linkError(403, "Voice actor work link is not authorized");
  }
  if (["55000", "23505", "40001", "40P01"].includes(code)) {
    throw linkError(409, "Work changed or the request id was reused; reload and retry");
  }
  if (["22023", "23503", "22P02", "22003"].includes(code)) {
    throw linkError(422, "Voice actor work references or values are invalid");
  }
  console.error("Controlled voice actor work creation failed", { code });
  throw linkError(500, "Voice actor work link failed; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body = parseBody(await readBody(event));
  const dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);

  // Reject unlinked users before spending external-provider quota. The RPC
  // repeats this check under a row lock before writing, so this is an early
  // denial only and never the authorization boundary for the mutation.
  if (user.app_metadata?.role !== "admin") {
    const { data: ownership, error: ownershipError } = await supabase
      .from("user_voice_actor_links")
      .select("id")
      .eq("user_id", user.id)
      .eq("voice_actor_id", body.voice_actor_id)
      .maybeSingle();
    if (ownershipError) {
      console.error("Failed to verify voice actor link ownership", {
        code: ownershipError.code,
      });
      throw linkError(500, "Voice actor ownership could not be verified");
    }
    if (!ownership) {
      throw linkError(403, "Voice actor work link is not authorized");
    }
  }

  const { data: voiceActor, error: voiceActorError } = await supabase
    .from("voice_actors")
    .select("*")
    .eq("id", body.voice_actor_id)
    .single();
  if (voiceActorError || !voiceActor) {
    throw linkError(404, "Voice actor not found");
  }

  await validateMediaReference(event, body);
  const { data: result, error } = await supabase.rpc("create_voice_actor_work_link", {
    p_user_id: user.id,
    p_request_id: body.request_id,
    p_voice_actor_id: body.voice_actor_id,
    p_content_id: body.media_id,
    p_content_type: body.media_type,
    p_language: dubbingLanguage,
    p_actor_person_id: body.actor_id,
    p_character_name: body.character_name,
    p_performance: body.performance,
  });
  if (error) mapRpcError(error.code);

  const mutation = result?.[0];
  if (!mutation) {
    throw linkError(500, "Voice actor work link failed; no changes were saved");
  }
  const { data: work, error: workError } = await supabase
    .from("work")
    .select("*")
    .eq("id", mutation.work_id)
    .single();
  if (workError || !work) {
    console.error("Controlled work link committed but result could not be loaded", {
      code: workError?.code,
    });
    throw linkError(500, "Work link was saved but could not be loaded; retry safely");
  }

  return {
    ...work,
    voiceActorDetails: voiceActor,
    auditLogId: mutation.audit_log_id,
    replayed: mutation.replayed,
  };
});
