import { defineUserHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";
import { notifyContributionEdit } from "../utils/notifications/contribution";
import { validateMediaReference } from "../utils/media-reference";
import { requireDubbingLanguage } from "../utils/dubbing-language";
import {
  DUBBING_PROJECT_MEDIA_TYPES,
  type DubbingProjectMediaType,
} from "../../src/utils/dubbing-project-save";
import { isRecord } from "@app/shared-logic";

type MediaType = DubbingProjectMediaType;

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
  game_character_id: string | null;
  dubbing_language: string;
}

function linkError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
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
  return DUBBING_PROJECT_MEDIA_TYPES.some((mediaType) => mediaType === value);
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
      "game_character_id",
      "dubbing_language",
    ])
  ) {
    throw linkError(400, "Request contains an unknown or protected field");
  }

  const actorId = value.actor_id;
  const gameCharacterId = value.game_character_id;
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
    (gameCharacterId !== undefined && gameCharacterId !== null && !isUuid(gameCharacterId)) ||
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
  const parsedGameCharacterId =
    gameCharacterId === undefined || gameCharacterId === null ? null : gameCharacterId;
  if (parsedGameCharacterId !== null && mediaType !== "video_game") {
    throw linkError(400, "Local game characters require a video game");
  }
  if (parsedGameCharacterId !== null && parsedActorId !== null) {
    throw linkError(400, "Local game characters cannot use provider actor ids");
  }

  return {
    request_id: value.request_id,
    voice_actor_id: value.voice_actor_id,
    media_type: mediaType,
    media_id: mediaId,
    character_name: characterName,
    performance,
    actor_id: parsedActorId,
    game_character_id: parsedGameCharacterId,
    dubbing_language: value.dubbing_language,
  };
}

function mapRpcError(code: string) {
  if (code === "42501" || code === "28000") {
    throw linkError(403, "Voice actor work link is not authorized");
  }
  if (["55000", "23505", "40001", "PT409", "40P01"].includes(code)) {
    throw linkError(409, "Work changed or the request id was reused; reload and retry");
  }
  if (["22023", "23503", "22P02", "22003"].includes(code)) {
    throw linkError(422, "Voice actor work references or values are invalid");
  }
  console.error("Controlled voice actor work creation failed", { code });
  throw linkError(500, "Voice actor work link failed; no changes were saved");
}

export default defineUserHandler(async (event, user) => {
  const body = parseBody(await readBody(event));
  const dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);

  // Any confirmed, unblocked contributor may add a credit. Reject accounts already known to be
  // blocked before spending external-provider quota; the RPC repeats this check under lock
  // (it reads the live flag, while this token claim can be stale), so this is an early
  // denial only and never the authorization boundary for the mutation.
  if (user.app_metadata?.blocked === true) {
    throw linkError(403, "Voice actor work link is not authorized");
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
    p_game_character_id: body.game_character_id,
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

  if (!mutation.replayed) {
    notifyContributionEdit(event, user, {
      entity: "voice actor",
      entityId: body.voice_actor_id,
      detail: `cast credit #${work.id} (${work.reviewed_status})`,
      path: `/voice-actor/${body.voice_actor_id}`,
    });
  }

  return {
    ...work,
    voiceActorDetails: voiceActor,
    auditLogId: mutation.audit_log_id,
    replayed: mutation.replayed,
  };
});
